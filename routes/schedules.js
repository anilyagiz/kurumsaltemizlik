const express = require('express');
const db = require('../database/db');
const { requireAuth, requireFacultyAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// Gün kodları
const DAY_NAMES = {
    'mon': 'Pazartesi',
    'tue': 'Salı',
    'wed': 'Çarşamba',
    'thu': 'Perşembe',
    'fri': 'Cuma',
    'sat': 'Cumartesi',
    'sun': 'Pazar'
};

// GET /api/schedules - Programları listele
router.get('/', (req, res) => {
    try {
        const user = req.session.user;
        const { staff_id, location_id, day_of_week } = req.query;

        let query = `
            SELECT s.*, 
                   l.name as location_name, l.type as location_type,
                   d.name as department_name,
                   b.name as building_name, b.faculty_id,
                   u.full_name as staff_name,
                   c.full_name as created_by_name
            FROM schedules s
            JOIN locations l ON s.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            JOIN users u ON s.staff_id = u.id
            LEFT JOIN users c ON s.created_by = c.id
            WHERE s.is_active = 1
        `;
        const params = [];

        // Fakülte filtresi
        if (user.role !== 'super_admin') {
            query += ' AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        if (staff_id) {
            query += ' AND s.staff_id = ?';
            params.push(staff_id);
        }

        if (location_id) {
            query += ' AND s.location_id = ?';
            params.push(location_id);
        }

        if (day_of_week) {
            query += ' AND s.day_of_week = ?';
            params.push(day_of_week);
        }

        // Geçerli programları göster
        query += ` AND (s.valid_until IS NULL OR s.valid_until >= date('now'))`;

        query += ' ORDER BY u.full_name, s.day_of_week';

        const schedules = db.prepare(query).all(...params);

        // Gün adlarını ekle
        const result = schedules.map(s => ({
            ...s,
            day_name: DAY_NAMES[s.day_of_week]
        }));

        res.json(result);
    } catch (error) {
        console.error('Programlar listelenirken hata:', error);
        res.status(500).json({ error: 'Programlar alınamadı' });
    }
});

// GET /api/schedules/weekly - Haftalık takvim görünümü
router.get('/weekly', (req, res) => {
    try {
        const user = req.session.user;

        let facultyFilter = '';
        const params = [];

        if (user.role !== 'super_admin') {
            facultyFilter = 'AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        // Personel bazlı haftalık program
        const staff = db.prepare(`
            SELECT u.id, u.full_name
            FROM users u
            WHERE u.role = 'staff' AND u.is_active = 1
            ${user.role !== 'super_admin' ? 'AND u.faculty_id = ?' : ''}
            ORDER BY u.full_name
        `).all(...(user.role !== 'super_admin' ? [user.faculty_id] : []));

        const result = staff.map(s => {
            const schedules = db.prepare(`
                SELECT sc.*, l.name as location_name, b.name as building_name
                FROM schedules sc
                JOIN locations l ON sc.location_id = l.id
                JOIN departments d ON l.department_id = d.id
                JOIN buildings b ON d.building_id = b.id
                WHERE sc.staff_id = ? AND sc.is_active = 1
                ${facultyFilter}
                AND (sc.valid_until IS NULL OR sc.valid_until >= date('now'))
            `).all(s.id, ...params);

            // Günlere göre grupla
            const days = {
                mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
            };

            schedules.forEach(sc => {
                days[sc.day_of_week].push({
                    id: sc.id,
                    location_id: sc.location_id,
                    location_name: sc.location_name,
                    building_name: sc.building_name
                });
            });

            return {
                staff_id: s.id,
                staff_name: s.full_name,
                ...days
            };
        });

        res.json({
            days: DAY_NAMES,
            schedules: result
        });
    } catch (error) {
        console.error('Haftalık takvim oluşturulurken hata:', error);
        res.status(500).json({ error: 'Haftalık takvim alınamadı' });
    }
});

// POST /api/schedules - Yeni program ekle (Faculty Admin)
router.post('/', requireFacultyAdmin, (req, res) => {
    try {
        const { location_id, staff_id, day_of_week, valid_from, valid_until } = req.body;
        const user = req.session.user;

        if (!location_id || !staff_id || !day_of_week || !valid_from) {
            return res.status(400).json({ error: 'Lokasyon, personel, gün ve başlangıç tarihi gerekli' });
        }

        // Gün kontrolü
        if (!DAY_NAMES[day_of_week]) {
            return res.status(400).json({ error: 'Geçersiz gün kodu' });
        }

        // Çakışma kontrolü
        const existing = db.prepare(`
            SELECT id FROM schedules 
            WHERE location_id = ? AND staff_id = ? AND day_of_week = ? AND is_active = 1
            AND (valid_until IS NULL OR valid_until >= ?)
        `).get(location_id, staff_id, day_of_week, valid_from);

        if (existing) {
            return res.status(400).json({ error: 'Bu gün için zaten bir program mevcut' });
        }

        const result = db.prepare(`
            INSERT INTO schedules (location_id, staff_id, day_of_week, valid_from, valid_until, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(location_id, staff_id, day_of_week, valid_from, valid_until || null, user.id);

        res.status(201).json({
            message: 'Program oluşturuldu',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Program oluşturulurken hata:', error);
        res.status(500).json({ error: 'Program oluşturulamadı' });
    }
});

// POST /api/schedules/bulk - Toplu program ekle
router.post('/bulk', requireFacultyAdmin, (req, res) => {
    try {
        const { staff_id, location_ids, days, valid_from, valid_until } = req.body;
        const user = req.session.user;

        if (!staff_id || !location_ids?.length || !days?.length || !valid_from) {
            return res.status(400).json({ error: 'Personel, lokasyonlar, günler ve başlangıç tarihi gerekli' });
        }

        const insert = db.prepare(`
            INSERT INTO schedules (location_id, staff_id, day_of_week, valid_from, valid_until, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        let count = 0;
        const transaction = db.transaction(() => {
            for (const location_id of location_ids) {
                for (const day of days) {
                    insert.run(location_id, staff_id, day, valid_from, valid_until || null, user.id);
                    count++;
                }
            }
        });

        transaction();

        res.status(201).json({
            message: `${count} program oluşturuldu`
        });
    } catch (error) {
        console.error('Toplu program oluşturulurken hata:', error);
        res.status(500).json({ error: 'Programlar oluşturulamadı' });
    }
});

// PUT /api/schedules/:id - Program güncelle
router.put('/:id', requireFacultyAdmin, (req, res) => {
    try {
        const { location_id, staff_id, day_of_week, valid_from, valid_until } = req.body;

        db.prepare(`
            UPDATE schedules 
            SET location_id = ?, staff_id = ?, day_of_week = ?, valid_from = ?, valid_until = ?
            WHERE id = ?
        `).run(location_id, staff_id, day_of_week, valid_from, valid_until || null, req.params.id);

        res.json({ message: 'Program güncellendi' });
    } catch (error) {
        res.status(500).json({ error: 'Program güncellenemedi' });
    }
});

// DELETE /api/schedules/:id - Program sil
router.delete('/:id', requireFacultyAdmin, (req, res) => {
    try {
        db.prepare('UPDATE schedules SET is_active = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Program silindi' });
    } catch (error) {
        res.status(500).json({ error: 'Program silinemedi' });
    }
});

// POST /api/schedules/generate-tasks - Bugünün görevlerini oluştur
router.post('/generate-tasks', requireFacultyAdmin, (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const user = req.session.user;

        // Günü bul
        const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(targetDate).getDay()];

        // Tatil kontrolü
        const holiday = db.prepare(`
            SELECT * FROM holidays WHERE date = ?
        `).get(targetDate);

        if (holiday) {
            return res.status(400).json({
                error: `${targetDate} tarihi resmi tatil: ${holiday.name}`
            });
        }

        // O gün için aktif programları bul
        let facultyFilter = '';
        const params = [dayOfWeek, targetDate, targetDate];

        if (user.role !== 'super_admin') {
            facultyFilter = 'AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        const schedules = db.prepare(`
            SELECT s.*, b.faculty_id
            FROM schedules s
            JOIN locations l ON s.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE s.day_of_week = ? 
            AND s.is_active = 1
            AND s.valid_from <= ?
            AND (s.valid_until IS NULL OR s.valid_until >= ?)
            ${facultyFilter}
        `).all(...params);

        if (schedules.length === 0) {
            return res.json({ message: 'Bu gün için program bulunamadı', created: 0 });
        }

        // Mevcut görevleri kontrol et (çift oluşturmamak için)
        const existingTasks = db.prepare(`
            SELECT schedule_id FROM tasks WHERE DATE(due_date) = ?
        `).all(targetDate);
        const existingScheduleIds = new Set(existingTasks.map(t => t.schedule_id));

        // Yeni görevler oluştur
        const insert = db.prepare(`
            INSERT INTO tasks (location_id, assigned_to, schedule_id, created_by, due_date, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `);

        let created = 0;
        const transaction = db.transaction(() => {
            for (const schedule of schedules) {
                if (!existingScheduleIds.has(schedule.id)) {
                    insert.run(
                        schedule.location_id,
                        schedule.staff_id,
                        schedule.id,
                        user.id,
                        targetDate
                    );
                    created++;
                }
            }
        });

        transaction();

        res.json({
            message: `${created} görev oluşturuldu`,
            created,
            date: targetDate,
            day: DAY_NAMES[dayOfWeek]
        });
    } catch (error) {
        console.error('Görevler oluşturulurken hata:', error);
        res.status(500).json({ error: 'Görevler oluşturulamadı' });
    }
});

// GET /api/schedules/holidays - Resmi tatilleri listele
router.get('/holidays', (req, res) => {
    try {
        const holidays = db.prepare(`
            SELECT * FROM holidays ORDER BY date
        `).all();

        res.json(holidays);
    } catch (error) {
        res.status(500).json({ error: 'Tatiller alınamadı' });
    }
});

module.exports = router;

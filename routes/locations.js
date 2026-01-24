const express = require('express');
const db = require('../database/db');
const { requireAuth, requireFacultyAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// ========================
// BİNALAR
// ========================

// GET /api/locations/buildings - Binaları listele
router.get('/buildings', (req, res) => {
    try {
        const user = req.session.user;
        let query = `
            SELECT b.*, f.name as faculty_name,
                   COUNT(DISTINCT d.id) as department_count
            FROM buildings b
            LEFT JOIN faculties f ON b.faculty_id = f.id
            LEFT JOIN departments d ON d.building_id = b.id AND d.is_active = 1
            WHERE b.is_active = 1
        `;
        const params = [];

        if (user.role !== 'super_admin') {
            query += ' AND b.faculty_id = ?';
            params.push(user.faculty_id);
        } else if (req.query.faculty_id) {
            query += ' AND b.faculty_id = ?';
            params.push(req.query.faculty_id);
        }

        query += ' GROUP BY b.id ORDER BY f.name, b.name';

        const buildings = db.prepare(query).all(...params);
        res.json(buildings);
    } catch (error) {
        console.error('Binalar listelenirken hata:', error);
        res.status(500).json({ error: 'Binalar alınamadı' });
    }
});

// POST /api/locations/buildings - Yeni bina
router.post('/buildings', requireFacultyAdmin, (req, res) => {
    try {
        const { name, code, faculty_id } = req.body;
        const user = req.session.user;

        const targetFacultyId = user.role === 'super_admin' ? faculty_id : user.faculty_id;

        if (!name || !code) {
            return res.status(400).json({ error: 'Bina adı ve kodu gerekli' });
        }

        const result = db.prepare(`
            INSERT INTO buildings (faculty_id, name, code) VALUES (?, ?, ?)
        `).run(targetFacultyId, name, code);

        res.status(201).json({
            message: 'Bina oluşturuldu',
            id: result.lastInsertRowid
        });
    } catch (error) {
        if (error.message?.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Bu bina kodu zaten kullanılıyor' });
        }
        console.error('Bina oluşturulurken hata:', error);
        res.status(500).json({ error: 'Bina oluşturulamadı' });
    }
});

// PUT /api/locations/buildings/:id
router.put('/buildings/:id', requireFacultyAdmin, (req, res) => {
    try {
        const { name, code } = req.body;

        db.prepare(`
            UPDATE buildings SET name = ?, code = ? WHERE id = ?
        `).run(name, code, req.params.id);

        res.json({ message: 'Bina güncellendi' });
    } catch (error) {
        res.status(500).json({ error: 'Bina güncellenemedi' });
    }
});

// DELETE /api/locations/buildings/:id
router.delete('/buildings/:id', requireFacultyAdmin, (req, res) => {
    try {
        db.prepare('UPDATE buildings SET is_active = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Bina pasifleştirildi' });
    } catch (error) {
        res.status(500).json({ error: 'Bina silinemedi' });
    }
});

// ========================
// DEPARTMANLAR (Katlar)
// ========================

// GET /api/locations/departments
router.get('/departments', (req, res) => {
    try {
        const { building_id } = req.query;

        let query = `
            SELECT d.*, b.name as building_name, b.code as building_code
            FROM departments d
            JOIN buildings b ON d.building_id = b.id
            WHERE d.is_active = 1 AND b.is_active = 1
        `;
        const params = [];

        if (building_id) {
            query += ' AND d.building_id = ?';
            params.push(building_id);
        }

        // Fakülte filtresi
        const user = req.session.user;
        if (user.role !== 'super_admin') {
            query += ' AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        query += ' ORDER BY b.name, d.floor, d.name';

        const departments = db.prepare(query).all(...params);
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: 'Departmanlar alınamadı' });
    }
});

// POST /api/locations/departments
router.post('/departments', requireFacultyAdmin, (req, res) => {
    try {
        const { building_id, name, floor } = req.body;

        if (!building_id || !name) {
            return res.status(400).json({ error: 'Bina ve departman adı gerekli' });
        }

        const result = db.prepare(`
            INSERT INTO departments (building_id, name, floor) VALUES (?, ?, ?)
        `).run(building_id, name, floor || null);

        res.status(201).json({
            message: 'Departman oluşturuldu',
            id: result.lastInsertRowid
        });
    } catch (error) {
        res.status(500).json({ error: 'Departman oluşturulamadı' });
    }
});

// PUT /api/locations/departments/:id
router.put('/departments/:id', requireFacultyAdmin, (req, res) => {
    try {
        const { name, floor } = req.body;

        db.prepare(`
            UPDATE departments SET name = ?, floor = ? WHERE id = ?
        `).run(name, floor, req.params.id);

        res.json({ message: 'Departman güncellendi' });
    } catch (error) {
        res.status(500).json({ error: 'Departman güncellenemedi' });
    }
});

// DELETE /api/locations/departments/:id
router.delete('/departments/:id', requireFacultyAdmin, (req, res) => {
    try {
        db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Departman pasifleştirildi' });
    } catch (error) {
        res.status(500).json({ error: 'Departman silinemedi' });
    }
});

// ========================
// LOKASYONLAR (Odalar)
// ========================

// GET /api/locations/rooms
router.get('/rooms', (req, res) => {
    try {
        const { department_id, building_id, type } = req.query;

        let query = `
            SELECT l.*, d.name as department_name, d.floor,
                   b.name as building_name, b.code as building_code
            FROM locations l
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE l.is_active = 1 AND d.is_active = 1 AND b.is_active = 1
        `;
        const params = [];

        if (department_id) {
            query += ' AND l.department_id = ?';
            params.push(department_id);
        }

        if (building_id) {
            query += ' AND d.building_id = ?';
            params.push(building_id);
        }

        if (type) {
            query += ' AND l.type = ?';
            params.push(type);
        }

        // Fakülte filtresi
        const user = req.session.user;
        if (user.role !== 'super_admin') {
            query += ' AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        query += ' ORDER BY b.name, d.floor, l.name';

        const rooms = db.prepare(query).all(...params);
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: 'Odalar alınamadı' });
    }
});

// POST /api/locations/rooms
router.post('/rooms', requireFacultyAdmin, (req, res) => {
    try {
        const { department_id, name, type } = req.body;

        if (!department_id || !name) {
            return res.status(400).json({ error: 'Departman ve oda adı gerekli' });
        }

        const result = db.prepare(`
            INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)
        `).run(department_id, name, type || 'room');

        res.status(201).json({
            message: 'Oda oluşturuldu',
            id: result.lastInsertRowid
        });
    } catch (error) {
        res.status(500).json({ error: 'Oda oluşturulamadı' });
    }
});

// PUT /api/locations/rooms/:id
router.put('/rooms/:id', requireFacultyAdmin, (req, res) => {
    try {
        const { name, type } = req.body;

        db.prepare(`
            UPDATE locations SET name = ?, type = ? WHERE id = ?
        `).run(name, type, req.params.id);

        res.json({ message: 'Oda güncellendi' });
    } catch (error) {
        res.status(500).json({ error: 'Oda güncellenemedi' });
    }
});

// DELETE /api/locations/rooms/:id
router.delete('/rooms/:id', requireFacultyAdmin, (req, res) => {
    try {
        db.prepare('UPDATE locations SET is_active = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Oda pasifleştirildi' });
    } catch (error) {
        res.status(500).json({ error: 'Oda silinemedi' });
    }
});

// ========================
// HIYERARŞİK GÖRÜNÜM
// ========================

// GET /api/locations/tree - Ağaç yapısında tüm lokasyonlar
router.get('/tree', (req, res) => {
    try {
        const user = req.session.user;
        let facultyFilter = '';
        const params = [];

        if (user.role !== 'super_admin') {
            facultyFilter = 'WHERE b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        const buildings = db.prepare(`
            SELECT b.*, f.name as faculty_name
            FROM buildings b
            LEFT JOIN faculties f ON b.faculty_id = f.id
            ${facultyFilter}
            ORDER BY f.name, b.name
        `).all(...params);

        const result = buildings.map(building => {
            const departments = db.prepare(`
                SELECT * FROM departments WHERE building_id = ? AND is_active = 1
                ORDER BY floor, name
            `).all(building.id);

            return {
                ...building,
                departments: departments.map(dept => {
                    const locations = db.prepare(`
                        SELECT * FROM locations WHERE department_id = ? AND is_active = 1
                        ORDER BY name
                    `).all(dept.id);

                    return { ...dept, locations };
                })
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Lokasyon ağacı oluşturulurken hata:', error);
        res.status(500).json({ error: 'Lokasyon ağacı alınamadı' });
    }
});

module.exports = router;

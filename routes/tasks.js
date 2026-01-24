const express = require('express');
const db = require('../database/db');
const { requireAuth, requireFacultyAdmin, requireSupervisor } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/tasks - Görev listesi
router.get('/', (req, res) => {
    try {
        const user = req.session.user;
        const { status, assigned_to, location_id, date, date_from, date_to } = req.query;

        let query = `
            SELECT t.*, 
                   l.name as location_name, l.type as location_type,
                   d.name as department_name, d.floor,
                   b.name as building_name, b.faculty_id,
                   u.full_name as assigned_to_name,
                   c.full_name as created_by_name,
                   a.full_name as approved_by_name
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users c ON t.created_by = c.id
            LEFT JOIN users a ON t.approved_by = a.id
            WHERE 1=1
        `;
        const params = [];

        // Rol bazlı filtreleme
        if (user.role === 'staff') {
            // Staff sadece kendi görevlerini görsün
            query += ' AND t.assigned_to = ?';
            params.push(user.id);
        } else if (user.role !== 'super_admin') {
            // Supervisor ve Faculty Admin kendi fakültesini görsün
            query += ' AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        // Filtreler
        if (status) {
            query += ' AND t.status = ?';
            params.push(status);
        }

        if (assigned_to) {
            query += ' AND t.assigned_to = ?';
            params.push(assigned_to);
        }

        if (location_id) {
            query += ' AND t.location_id = ?';
            params.push(location_id);
        }

        if (date) {
            query += ' AND DATE(t.due_date) = ?';
            params.push(date);
        }

        if (date_from) {
            query += ' AND DATE(t.due_date) >= ?';
            params.push(date_from);
        }

        if (date_to) {
            query += ' AND DATE(t.due_date) <= ?';
            params.push(date_to);
        }

        query += ' ORDER BY t.due_date DESC, t.created_at DESC';

        const tasks = db.prepare(query).all(...params);
        res.json(tasks);
    } catch (error) {
        console.error('Görevler listelenirken hata:', error);
        res.status(500).json({ error: 'Görevler alınamadı' });
    }
});

// GET /api/tasks/today - Bugünün görevleri
router.get('/today', (req, res) => {
    try {
        const user = req.session.user;
        const today = new Date().toISOString().split('T')[0];

        let query = `
            SELECT t.*, 
                   l.name as location_name, l.type as location_type,
                   d.name as department_name,
                   b.name as building_name
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) = ?
        `;
        const params = [today];

        if (user.role === 'staff') {
            query += ' AND t.assigned_to = ?';
            params.push(user.id);
        } else if (user.role !== 'super_admin') {
            query += ' AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        query += ' ORDER BY t.status, l.name';

        const tasks = db.prepare(query).all(...params);
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Bugünün görevleri alınamadı' });
    }
});

// GET /api/tasks/pending-approval - Onay bekleyen görevler (Supervisor+)
router.get('/pending-approval', requireSupervisor, (req, res) => {
    try {
        const user = req.session.user;

        let query = `
            SELECT t.*, 
                   l.name as location_name,
                   b.name as building_name,
                   u.full_name as assigned_to_name
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.status = 'completed'
        `;
        const params = [];

        if (user.role !== 'super_admin') {
            query += ' AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        query += ' ORDER BY t.completed_at ASC';

        const tasks = db.prepare(query).all(...params);
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Onay bekleyen görevler alınamadı' });
    }
});

// GET /api/tasks/:id - Tek görev
router.get('/:id', (req, res) => {
    try {
        const task = db.prepare(`
            SELECT t.*, 
                   l.name as location_name, l.type as location_type,
                   d.name as department_name, d.floor,
                   b.name as building_name, b.faculty_id,
                   u.full_name as assigned_to_name,
                   c.full_name as created_by_name,
                   a.full_name as approved_by_name
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users c ON t.created_by = c.id
            LEFT JOIN users a ON t.approved_by = a.id
            WHERE t.id = ?
        `).get(req.params.id);

        if (!task) {
            return res.status(404).json({ error: 'Görev bulunamadı' });
        }

        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Görev alınamadı' });
    }
});

// POST /api/tasks - Yeni görev oluştur (Admin/Supervisor)
router.post('/', requireSupervisor, (req, res) => {
    try {
        const { location_id, assigned_to, priority, due_date, notes } = req.body;
        const user = req.session.user;

        if (!location_id || !assigned_to || !due_date) {
            return res.status(400).json({ error: 'Lokasyon, personel ve tarih gerekli' });
        }

        const result = db.prepare(`
            INSERT INTO tasks (location_id, assigned_to, created_by, priority, due_date, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `).run(location_id, assigned_to, user.id, priority || 'normal', due_date, notes || null);

        res.status(201).json({
            message: 'Görev oluşturuldu',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Görev oluşturulurken hata:', error);
        res.status(500).json({ error: 'Görev oluşturulamadı' });
    }
});

// PUT /api/tasks/:id/start - Göreve başla (Staff)
router.put('/:id/start', (req, res) => {
    try {
        const taskId = req.params.id;
        const user = req.session.user;

        // Görev kontrolü
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Görev bulunamadı' });
        }

        // Sadece atanan kişi başlatabilir
        if (task.assigned_to !== user.id && user.role === 'staff') {
            return res.status(403).json({ error: 'Bu görevi başlatma yetkiniz yok' });
        }

        if (task.status !== 'pending') {
            return res.status(400).json({ error: 'Bu görev zaten başlatılmış' });
        }

        db.prepare(`
            UPDATE tasks SET status = 'in_progress', started_at = datetime('now')
            WHERE id = ?
        `).run(taskId);

        res.json({ message: 'Görev başlatıldı' });
    } catch (error) {
        res.status(500).json({ error: 'Görev başlatılamadı' });
    }
});

// PUT /api/tasks/:id/complete - Görevi tamamla (Staff)
router.put('/:id/complete', (req, res) => {
    try {
        const taskId = req.params.id;
        const user = req.session.user;
        const { notes } = req.body;

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Görev bulunamadı' });
        }

        if (task.assigned_to !== user.id && user.role === 'staff') {
            return res.status(403).json({ error: 'Bu görevi tamamlama yetkiniz yok' });
        }

        if (task.status === 'completed' || task.status === 'approved') {
            return res.status(400).json({ error: 'Bu görev zaten tamamlanmış' });
        }

        db.prepare(`
            UPDATE tasks 
            SET status = 'completed', completed_at = datetime('now'), notes = COALESCE(?, notes)
            WHERE id = ?
        `).run(notes || null, taskId);

        res.json({ message: 'Görev tamamlandı, onay bekleniyor' });
    } catch (error) {
        console.error('Görev tamamlanırken hata:', error);
        res.status(500).json({ error: 'Görev tamamlanamadı', details: error.message });
    }
});

// PUT /api/tasks/:id/approve - Görevi onayla (Supervisor+)
router.put('/:id/approve', requireSupervisor, (req, res) => {
    try {
        const taskId = req.params.id;
        const user = req.session.user;

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Görev bulunamadı' });
        }

        if (task.status !== 'completed') {
            return res.status(400).json({ error: 'Sadece tamamlanmış görevler onaylanabilir' });
        }

        db.prepare(`
            UPDATE tasks 
            SET status = 'approved', approved_by = ?, approved_at = datetime('now')
            WHERE id = ?
        `).run(user.id, taskId);

        res.json({ message: 'Görev onaylandı' });
    } catch (error) {
        res.status(500).json({ error: 'Görev onaylanamadı' });
    }
});

// PUT /api/tasks/:id/reject - Görevi reddet (Supervisor+)
router.put('/:id/reject', requireSupervisor, (req, res) => {
    try {
        const taskId = req.params.id;
        const user = req.session.user;
        const { rejection_reason } = req.body;

        if (!rejection_reason) {
            return res.status(400).json({ error: 'Red nedeni belirtilmeli' });
        }

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Görev bulunamadı' });
        }

        if (task.status !== 'completed') {
            return res.status(400).json({ error: 'Sadece tamamlanmış görevler reddedilebilir' });
        }

        db.prepare(`
            UPDATE tasks 
            SET status = 'rejected', approved_by = ?, rejection_reason = ?, approved_at = datetime('now')
            WHERE id = ?
        `).run(user.id, rejection_reason, taskId);

        res.json({ message: 'Görev reddedildi' });
    } catch (error) {
        res.status(500).json({ error: 'Görev reddedilemedi' });
    }
});

// DELETE /api/tasks/:id - Görev sil (Admin)
router.delete('/:id', requireFacultyAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
        res.json({ message: 'Görev silindi' });
    } catch (error) {
        res.status(500).json({ error: 'Görev silinemedi' });
    }
});

module.exports = router;

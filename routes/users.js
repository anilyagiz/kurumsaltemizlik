const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireAuth, requireFacultyAdmin, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/users - Kullanıcıları listele
router.get('/', requireFacultyAdmin, (req, res) => {
    try {
        const user = req.session.user;
        const { faculty_id, role } = req.query;

        let query = `
            SELECT u.id, u.username, u.full_name, u.role, u.faculty_id, 
                   u.is_active, u.created_at, f.name as faculty_name
            FROM users u
            LEFT JOIN faculties f ON u.faculty_id = f.id
            WHERE 1=1
        `;
        const params = [];

        // Super admin değilse sadece kendi fakültesini görsün
        if (user.role !== 'super_admin') {
            query += ' AND u.faculty_id = ?';
            params.push(user.faculty_id);
        } else if (faculty_id) {
            query += ' AND u.faculty_id = ?';
            params.push(faculty_id);
        }

        if (role) {
            query += ' AND u.role = ?';
            params.push(role);
        }

        query += ' ORDER BY u.full_name';

        const users = db.prepare(query).all(...params);
        res.json(users);
    } catch (error) {
        console.error('Kullanıcılar listelenirken hata:', error);
        res.status(500).json({ error: 'Kullanıcılar alınamadı' });
    }
});

// GET /api/users/staff - Sadece personel listesi (görev atama için)
router.get('/staff', (req, res) => {
    try {
        const user = req.session.user;
        let query = `
            SELECT id, full_name, faculty_id 
            FROM users 
            WHERE role = 'staff' AND is_active = 1
        `;
        const params = [];

        if (user.role !== 'super_admin') {
            query += ' AND faculty_id = ?';
            params.push(user.faculty_id);
        }

        query += ' ORDER BY full_name';

        const staff = db.prepare(query).all(...params);
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: 'Personel listesi alınamadı' });
    }
});

// GET /api/users/:id - Tek kullanıcı
router.get('/:id', requireFacultyAdmin, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT u.id, u.username, u.full_name, u.role, u.faculty_id, 
                   u.is_active, u.created_at, f.name as faculty_name
            FROM users u
            LEFT JOIN faculties f ON u.faculty_id = f.id
            WHERE u.id = ?
        `).get(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Fakülte kontrolü
        const currentUser = req.session.user;
        if (currentUser.role !== 'super_admin' && user.faculty_id !== currentUser.faculty_id) {
            return res.status(403).json({ error: 'Bu kullanıcıya erişim yetkiniz yok' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Kullanıcı alınamadı' });
    }
});

// POST /api/users - Yeni kullanıcı
router.post('/', requireFacultyAdmin, (req, res) => {
    try {
        const { username, password, full_name, role, faculty_id } = req.body;
        const currentUser = req.session.user;

        if (!username || !password || !full_name || !role) {
            return res.status(400).json({ error: 'Tüm alanlar gerekli' });
        }

        // Rol kontrolü
        if (role === 'super_admin' && currentUser.role !== 'super_admin') {
            return res.status(403).json({ error: 'Super Admin oluşturamazsınız' });
        }

        // Fakülte kontrolü
        let targetFacultyId = faculty_id;
        if (currentUser.role !== 'super_admin') {
            targetFacultyId = currentUser.faculty_id;
        }

        const password_hash = bcrypt.hashSync(password, 12);

        const result = db.prepare(`
            INSERT INTO users (username, password_hash, full_name, role, faculty_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(username, password_hash, full_name, role, targetFacultyId);

        res.status(201).json({
            message: 'Kullanıcı oluşturuldu',
            id: result.lastInsertRowid
        });
    } catch (error) {
        if (error.message?.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
        }
        console.error('Kullanıcı oluşturulurken hata:', error);
        res.status(500).json({ error: 'Kullanıcı oluşturulamadı' });
    }
});

// PUT /api/users/:id - Kullanıcı güncelle
router.put('/:id', requireFacultyAdmin, (req, res) => {
    try {
        const { full_name, role, is_active, password } = req.body;
        const userId = req.params.id;
        const currentUser = req.session.user;

        // Mevcut kullanıcıyı al
        const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!existingUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Fakülte kontrolü
        if (currentUser.role !== 'super_admin' && existingUser.faculty_id !== currentUser.faculty_id) {
            return res.status(403).json({ error: 'Bu kullanıcıyı düzenleme yetkiniz yok' });
        }

        // Güncelle
        if (password) {
            const password_hash = bcrypt.hashSync(password, 12);
            db.prepare(`
                UPDATE users SET full_name = ?, role = ?, is_active = ?, password_hash = ?
                WHERE id = ?
            `).run(full_name, role, is_active ? 1 : 0, password_hash, userId);
        } else {
            db.prepare(`
                UPDATE users SET full_name = ?, role = ?, is_active = ?
                WHERE id = ?
            `).run(full_name, role, is_active ? 1 : 0, userId);
        }

        res.json({ message: 'Kullanıcı güncellendi' });
    } catch (error) {
        console.error('Kullanıcı güncellenirken hata:', error);
        res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
    }
});

// DELETE /api/users/:id - Kullanıcı pasifle
router.delete('/:id', requireFacultyAdmin, (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.session.user;

        // Kendi hesabını silemez
        if (parseInt(userId) === currentUser.id) {
            return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
        }

        db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(userId);
        res.json({ message: 'Kullanıcı pasifleştirildi' });
    } catch (error) {
        res.status(500).json({ error: 'Kullanıcı silinemedi' });
    }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const router = express.Router();

// POST /api/auth/login - Giriş yap
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }

        const user = db.prepare(`
            SELECT u.*, f.name as faculty_name, f.code as faculty_code
            FROM users u
            LEFT JOIN faculties f ON u.faculty_id = f.id
            WHERE u.username = ? AND u.is_active = 1
        `).get(username);

        if (!user) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Şifre hatalı' });
        }

        // Session'a kullanıcı bilgilerini kaydet
        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            faculty_id: user.faculty_id,
            faculty_name: user.faculty_name,
            faculty_code: user.faculty_code
        };

        res.json({
            message: 'Giriş başarılı',
            user: req.session.user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Giriş yapılırken hata oluştu' });
    }
});

// POST /api/auth/logout - Çıkış yap
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Çıkış yapılırken hata oluştu' });
        }
        res.json({ message: 'Çıkış başarılı' });
    });
});

// GET /api/auth/me - Mevcut oturum bilgisi
router.get('/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Oturum açılmamış' });
    }
    res.json({ user: req.session.user });
});

module.exports = router;

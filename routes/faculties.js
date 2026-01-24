const express = require('express');
const db = require('../database/db');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Tüm route'lar için auth gerekli
router.use(requireAuth);

// GET /api/faculties - Tüm fakülteleri listele
router.get('/', (req, res) => {
    try {
        const faculties = db.prepare(`
            SELECT f.*, 
                   COUNT(DISTINCT u.id) as user_count,
                   COUNT(DISTINCT b.id) as building_count
            FROM faculties f
            LEFT JOIN users u ON u.faculty_id = f.id AND u.is_active = 1
            LEFT JOIN buildings b ON b.faculty_id = f.id AND b.is_active = 1
            WHERE f.is_active = 1
            GROUP BY f.id
            ORDER BY f.name
        `).all();

        res.json(faculties);
    } catch (error) {
        console.error('Fakülteler listelenirken hata:', error);
        res.status(500).json({ error: 'Fakülteler alınamadı' });
    }
});

// GET /api/faculties/:id - Tek fakülte
router.get('/:id', (req, res) => {
    try {
        const faculty = db.prepare(`
            SELECT * FROM faculties WHERE id = ? AND is_active = 1
        `).get(req.params.id);

        if (!faculty) {
            return res.status(404).json({ error: 'Fakülte bulunamadı' });
        }

        res.json(faculty);
    } catch (error) {
        res.status(500).json({ error: 'Fakülte alınamadı' });
    }
});

// POST /api/faculties - Yeni fakülte (Super Admin)
router.post('/', requireSuperAdmin, (req, res) => {
    try {
        const { name, code, color } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Fakülte adı ve kodu gerekli' });
        }

        const result = db.prepare(`
            INSERT INTO faculties (name, code, color) VALUES (?, ?, ?)
        `).run(name, code.toUpperCase(), color || '#1e40af');

        res.status(201).json({
            message: 'Fakülte oluşturuldu',
            id: result.lastInsertRowid
        });
    } catch (error) {
        if (error.message?.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Bu fakülte kodu zaten kullanılıyor' });
        }
        console.error('Fakülte oluşturulurken hata:', error);
        res.status(500).json({ error: 'Fakülte oluşturulamadı' });
    }
});

// PUT /api/faculties/:id - Fakülte güncelle (Super Admin)
router.put('/:id', requireSuperAdmin, (req, res) => {
    try {
        const { name, code, color } = req.body;

        db.prepare(`
            UPDATE faculties SET name = ?, code = ?, color = ? WHERE id = ?
        `).run(name, code?.toUpperCase(), color, req.params.id);

        res.json({ message: 'Fakülte güncellendi' });
    } catch (error) {
        res.status(500).json({ error: 'Fakülte güncellenemedi' });
    }
});

// DELETE /api/faculties/:id - Fakülte pasifle (Super Admin)
router.delete('/:id', requireSuperAdmin, (req, res) => {
    try {
        db.prepare(`
            UPDATE faculties SET is_active = 0 WHERE id = ?
        `).run(req.params.id);

        res.json({ message: 'Fakülte pasifleştirildi' });
    } catch (error) {
        res.status(500).json({ error: 'Fakülte silinemedi' });
    }
});

module.exports = router;

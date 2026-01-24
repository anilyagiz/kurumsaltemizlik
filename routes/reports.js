const express = require('express');
const db = require('../database/db');
const { requireAuth, requireFacultyAdmin, requireSupervisor } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/reports/daily - Günlük özet
router.get('/daily', (req, res) => {
    try {
        const user = req.session.user;
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        let facultyFilter = '';
        const params = [targetDate];

        if (user.role !== 'super_admin') {
            facultyFilter = 'AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        // Genel istatistikler
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) = ? ${facultyFilter}
        `).get(...params);

        // Personel bazlı
        const byStaff = db.prepare(`
            SELECT u.full_name,
                   COUNT(*) as total,
                   SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as done
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) = ? ${facultyFilter}
            GROUP BY u.id
            ORDER BY done DESC
        `).all(...params);

        res.json({
            date: targetDate,
            summary: stats,
            by_staff: byStaff,
            completion_rate: stats.total > 0
                ? ((stats.completed + stats.approved) / stats.total * 100).toFixed(1) + '%'
                : '0%'
        });
    } catch (error) {
        console.error('Günlük rapor oluşturulurken hata:', error);
        res.status(500).json({ error: 'Günlük rapor alınamadı' });
    }
});

// GET /api/reports/weekly - Haftalık rapor
router.get('/weekly', requireSupervisor, (req, res) => {
    try {
        const user = req.session.user;
        const { start } = req.query;

        // Haftanın başlangıcını hesapla (Pazartesi)
        let startDate;
        if (start) {
            startDate = start;
        } else {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            startDate = new Date(today.setDate(diff)).toISOString().split('T')[0];
        }

        const endDate = new Date(new Date(startDate).getTime() + 6 * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        let facultyFilter = '';
        const params = [startDate, endDate];

        if (user.role !== 'super_admin') {
            facultyFilter = 'AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        // Haftalık özet
        const summary = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
        `).get(...params);

        // Personel performansı
        const byStaff = db.prepare(`
            SELECT u.id, u.full_name,
                   COUNT(*) as total,
                   SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as completed,
                   SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved,
                   SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
            GROUP BY u.id
            ORDER BY approved DESC
        `).all(...params);

        // Günlük dağılım
        const byDay = db.prepare(`
            SELECT DATE(t.due_date) as date,
                   COUNT(*) as total,
                   SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as completed
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
            GROUP BY DATE(t.due_date)
            ORDER BY date
        `).all(...params);

        // Bina bazlı
        const byBuilding = db.prepare(`
            SELECT b.name as building_name,
                   COUNT(*) as total,
                   SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as completed
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
            GROUP BY b.id
            ORDER BY total DESC
        `).all(...params);

        res.json({
            period: { start: startDate, end: endDate },
            summary: {
                ...summary,
                completion_rate: summary.total > 0
                    ? ((summary.completed) / summary.total * 100).toFixed(1) + '%'
                    : '0%',
                approval_rate: summary.completed > 0
                    ? (summary.approved / summary.completed * 100).toFixed(1) + '%'
                    : '0%'
            },
            by_staff: byStaff.map(s => ({
                ...s,
                rate: s.total > 0 ? ((s.completed) / s.total * 100).toFixed(1) + '%' : '0%'
            })),
            by_day: byDay,
            by_building: byBuilding
        });
    } catch (error) {
        console.error('Haftalık rapor oluşturulurken hata:', error);
        res.status(500).json({ error: 'Haftalık rapor alınamadı' });
    }
});

// GET /api/reports/monthly - Aylık rapor
router.get('/monthly', requireFacultyAdmin, (req, res) => {
    try {
        const user = req.session.user;
        const { month } = req.query;

        // Ay formatı: YYYY-MM
        const targetMonth = month || new Date().toISOString().slice(0, 7);
        const startDate = targetMonth + '-01';
        const endDate = new Date(
            new Date(startDate).getFullYear(),
            new Date(startDate).getMonth() + 1,
            0
        ).toISOString().split('T')[0];

        let facultyFilter = '';
        const params = [startDate, endDate];

        if (user.role !== 'super_admin') {
            facultyFilter = 'AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        // Aylık özet
        const summary = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
        `).get(...params);

        // Haftalık trend
        const byWeek = db.prepare(`
            SELECT 
                strftime('%W', t.due_date) as week_number,
                MIN(DATE(t.due_date)) as week_start,
                COUNT(*) as total,
                SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as completed
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
            GROUP BY strftime('%W', t.due_date)
            ORDER BY week_number
        `).all(...params);

        // En çok görev yapan personel
        const topStaff = db.prepare(`
            SELECT u.full_name,
                   COUNT(*) as total,
                   SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
            GROUP BY u.id
            ORDER BY approved DESC
            LIMIT 10
        `).all(...params);

        res.json({
            month: targetMonth,
            period: { start: startDate, end: endDate },
            summary: {
                ...summary,
                completion_rate: summary.total > 0
                    ? ((summary.completed) / summary.total * 100).toFixed(1) + '%'
                    : '0%'
            },
            by_week: byWeek,
            top_staff: topStaff
        });
    } catch (error) {
        console.error('Aylık rapor oluşturulurken hata:', error);
        res.status(500).json({ error: 'Aylık rapor alınamadı' });
    }
});

// GET /api/reports/dashboard - Dashboard istatistikleri
router.get('/dashboard', (req, res) => {
    try {
        const user = req.session.user;
        const today = new Date().toISOString().split('T')[0];

        let facultyFilter = '';
        let staffFilter = '';
        const params = [];

        if (user.role === 'staff') {
            staffFilter = 'AND t.assigned_to = ?';
            params.push(user.id);
        } else if (user.role !== 'super_admin') {
            facultyFilter = 'AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        // Bugünün görevleri
        const todayTasks = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as done
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) = ? ${facultyFilter} ${staffFilter}
        `).get(today, ...params);

        // Onay bekleyenler (Supervisor+)
        let pendingApproval = { count: 0 };
        if (user.role !== 'staff') {
            pendingApproval = db.prepare(`
                SELECT COUNT(*) as count
                FROM tasks t
                JOIN locations l ON t.location_id = l.id
                JOIN departments d ON l.department_id = d.id
                JOIN buildings b ON d.building_id = b.id
                WHERE t.status = 'completed' ${facultyFilter}
            `).get(...(user.role !== 'super_admin' ? [user.faculty_id] : []));
        }

        // Bu haftanın performansı
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const weekParams = [weekStartStr, today, ...params];
        const weekStats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN t.status IN ('completed', 'approved') THEN 1 ELSE 0 END) as completed
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter} ${staffFilter}
        `).get(...weekParams);

        res.json({
            today: {
                date: today,
                ...todayTasks,
                completion_rate: todayTasks.total > 0
                    ? ((todayTasks.done) / todayTasks.total * 100).toFixed(0) + '%'
                    : '0%'
            },
            pending_approval: pendingApproval.count,
            this_week: {
                ...weekStats,
                completion_rate: weekStats.total > 0
                    ? ((weekStats.completed) / weekStats.total * 100).toFixed(0) + '%'
                    : '0%'
            }
        });
    } catch (error) {
        console.error('Dashboard istatistikleri oluşturulurken hata:', error);
        res.status(500).json({ error: 'Dashboard verileri alınamadı' });
    }
});

// GET /api/reports/export - CSV export
router.get('/export', requireFacultyAdmin, (req, res) => {
    try {
        const user = req.session.user;
        const { type, start, end } = req.query;

        if (!start || !end) {
            return res.status(400).json({ error: 'Başlangıç ve bitiş tarihi gerekli' });
        }

        let facultyFilter = '';
        const params = [start, end];

        if (user.role !== 'super_admin') {
            facultyFilter = 'AND b.faculty_id = ?';
            params.push(user.faculty_id);
        }

        const tasks = db.prepare(`
            SELECT 
                DATE(t.due_date) as tarih,
                b.name as bina,
                d.name as kat,
                l.name as oda,
                u.full_name as personel,
                t.status as durum,
                t.completed_at as tamamlanma,
                t.approved_at as onay
            FROM tasks t
            JOIN locations l ON t.location_id = l.id
            JOIN departments d ON l.department_id = d.id
            JOIN buildings b ON d.building_id = b.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE DATE(t.due_date) BETWEEN ? AND ? ${facultyFilter}
            ORDER BY t.due_date, b.name, l.name
        `).all(...params);

        // CSV oluştur
        const headers = ['Tarih', 'Bina', 'Kat', 'Oda', 'Personel', 'Durum', 'Tamamlanma', 'Onay'];
        const statusMap = {
            pending: 'Bekliyor',
            in_progress: 'Devam Ediyor',
            completed: 'Tamamlandı',
            approved: 'Onaylandı',
            rejected: 'Reddedildi'
        };

        let csv = headers.join(';') + '\n';
        tasks.forEach(t => {
            csv += [
                t.tarih,
                t.bina,
                t.kat,
                t.oda,
                t.personel || '-',
                statusMap[t.durum] || t.durum,
                t.tamamlanma || '-',
                t.onay || '-'
            ].join(';') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=rapor_${start}_${end}.csv`);
        res.send('\uFEFF' + csv); // BOM for Excel Unicode support
    } catch (error) {
        console.error('Export oluşturulurken hata:', error);
        res.status(500).json({ error: 'Export oluşturulamadı' });
    }
});

module.exports = router;

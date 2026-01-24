const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// Database - Initialize before routes
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'kirikkale-temizlik-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Sunucu hatası', message: err.message });
});

// Start server after database is ready
async function startServer() {
    try {
        console.log('📦 Veritabanı başlatılıyor...');
        await db.initDatabase();
        console.log('✅ Veritabanı hazır');

        // Routes - Load after database is initialized
        const authRoutes = require('./routes/auth');
        const facultyRoutes = require('./routes/faculties');
        const userRoutes = require('./routes/users');
        const locationRoutes = require('./routes/locations');
        const taskRoutes = require('./routes/tasks');
        const scheduleRoutes = require('./routes/schedules');
        const reportRoutes = require('./routes/reports');

        // API Routes
        app.use('/api/auth', authRoutes);
        app.use('/api/faculties', facultyRoutes);
        app.use('/api/users', userRoutes);
        app.use('/api/locations', locationRoutes);
        app.use('/api/tasks', taskRoutes);
        app.use('/api/schedules', scheduleRoutes);
        app.use('/api/reports', reportRoutes);

        app.listen(PORT, () => {
            console.log(`🧹 Temizlik Takip Sistemi çalışıyor: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Sunucu başlatılamadı:', error);
        process.exit(1);
    }
}

startServer();

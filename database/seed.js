const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'kirikkale.db');

// Şifre hashleme
const hashPassword = (password) => bcrypt.hashSync(password, 12);

async function seedDatabase() {
    const SQL = await initSqlJs();

    // Mevcut veritabanını yükle
    if (!fs.existsSync(dbPath)) {
        console.error('❌ Veritabanı bulunamadı! Önce npm run db:init çalıştırın.');
        process.exit(1);
    }

    const existingBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(existingBuffer);
    db.run('PRAGMA foreign_keys = ON');

    console.log('🌱 Seed verileri ekleniyor...\n');

    // ===============================
    // FAKÜLTELER
    // ===============================
    const faculties = [
        { name: 'Mühendislik Fakültesi', code: 'MUH', color: '#1e40af' },
        { name: 'Fen-Edebiyat Fakültesi', code: 'FEN', color: '#7c3aed' },
        { name: 'Tıp Fakültesi', code: 'TIP', color: '#dc2626' },
        { name: 'Hukuk Fakültesi', code: 'HUK', color: '#0d9488' },
        { name: 'İktisadi ve İdari Bilimler Fakültesi', code: 'IKT', color: '#ea580c' },
        { name: 'Eğitim Fakültesi', code: 'EGT', color: '#16a34a' }
    ];

    faculties.forEach(f => {
        db.run('INSERT INTO faculties (name, code, color) VALUES (?, ?, ?)', [f.name, f.code, f.color]);
    });
    console.log('✅ Fakülteler eklendi');

    // ===============================
    // KULLANICILAR
    // ===============================
    // Super Admin (fakülte bağımsız)
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [null, 'superadmin', hashPassword('super123'), 'Sistem Yöneticisi', 'super_admin']);

    // Mühendislik Fakültesi (id: 1)
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [1, 'muh_admin', hashPassword('admin123'), 'Mehmet Kaya', 'faculty_admin']);
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [1, 'muh_sup1', hashPassword('super123'), 'Ayşe Demir', 'supervisor']);
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [1, 'muh_temiz1', hashPassword('temiz123'), 'Ahmet Yılmaz', 'staff']);
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [1, 'muh_temiz2', hashPassword('temiz123'), 'Fatma Şahin', 'staff']);

    // Fen-Edebiyat Fakültesi (id: 2)
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [2, 'fen_admin', hashPassword('admin123'), 'Ali Öztürk', 'faculty_admin']);
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [2, 'fen_sup1', hashPassword('super123'), 'Zeynep Aksoy', 'supervisor']);
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [2, 'fen_temiz1', hashPassword('temiz123'), 'Mustafa Çelik', 'staff']);

    // Tıp Fakültesi (id: 3)
    db.run('INSERT INTO users (faculty_id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [3, 'tip_admin', hashPassword('admin123'), 'Dr. Hasan Koç', 'faculty_admin']);

    console.log('✅ Kullanıcılar eklendi');

    // ===============================
    // BİNALAR
    // ===============================
    // Mühendislik Fakültesi binaları
    db.run('INSERT INTO buildings (faculty_id, name, code) VALUES (?, ?, ?)', [1, 'A Blok - Mühendislik', 'MUH-A']);
    db.run('INSERT INTO buildings (faculty_id, name, code) VALUES (?, ?, ?)', [1, 'B Blok - Laboratuvarlar', 'MUH-B']);

    // Fen-Edebiyat Fakültesi binaları
    db.run('INSERT INTO buildings (faculty_id, name, code) VALUES (?, ?, ?)', [2, 'Fen Fakültesi Binası', 'FEN-A']);

    // Tıp Fakültesi binaları
    db.run('INSERT INTO buildings (faculty_id, name, code) VALUES (?, ?, ?)', [3, 'Morfoloji Binası', 'TIP-M']);

    console.log('✅ Binalar eklendi');

    // ===============================
    // DEPARTMANLAR (Katlar)
    // ===============================
    // MUH-A Blok katları (building_id: 1)
    db.run('INSERT INTO departments (building_id, name, floor) VALUES (?, ?, ?)', [1, 'Zemin Kat', '0']);
    db.run('INSERT INTO departments (building_id, name, floor) VALUES (?, ?, ?)', [1, '1. Kat', '1']);
    db.run('INSERT INTO departments (building_id, name, floor) VALUES (?, ?, ?)', [1, '2. Kat', '2']);

    // MUH-B Blok (building_id: 2)
    db.run('INSERT INTO departments (building_id, name, floor) VALUES (?, ?, ?)', [2, 'Zemin Kat', '0']);

    // FEN-A (building_id: 3)
    db.run('INSERT INTO departments (building_id, name, floor) VALUES (?, ?, ?)', [3, 'Zemin Kat', '0']);
    db.run('INSERT INTO departments (building_id, name, floor) VALUES (?, ?, ?)', [3, '1. Kat', '1']);

    console.log('✅ Departmanlar eklendi');

    // ===============================
    // LOKASYONLAR (Odalar)
    // ===============================
    // MUH-A Zemin Kat (department_id: 1)
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [1, 'Giriş Holü', 'corridor']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [1, 'Erkek WC', 'toilet']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [1, 'Kadın WC', 'toilet']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [1, 'Dekanlık Ofisi', 'office']);

    // MUH-A 1. Kat (department_id: 2)
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [2, 'A101 - Derslik', 'room']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [2, 'A102 - Derslik', 'room']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [2, 'A103 - Derslik', 'room']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [2, 'Koridor', 'corridor']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [2, 'WC', 'toilet']);

    // MUH-A 2. Kat (department_id: 3)
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [3, 'A201 - Bilgisayar Lab', 'lab']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [3, 'A202 - Elektrik Lab', 'lab']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [3, 'A203 - Derslik', 'room']);

    // MUH-B Zemin (department_id: 4)
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [4, 'Makine Atölyesi', 'lab']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [4, 'Malzeme Lab', 'lab']);

    // FEN-A Zemin (department_id: 5)
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [5, 'Kimya Lab', 'lab']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [5, 'Fizik Lab', 'lab']);

    // FEN-A 1. Kat (department_id: 6)
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [6, 'F101 - Derslik', 'room']);
    db.run('INSERT INTO locations (department_id, name, type) VALUES (?, ?, ?)', [6, 'F102 - Derslik', 'room']);

    console.log('✅ Lokasyonlar eklendi');

    // ===============================
    // RESMİ TATİLLER (Türkiye)
    // ===============================
    // Sabit tarihli tatiller (her yıl aynı)
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Yılbaşı', '2025-01-01', 1]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Ulusal Egemenlik ve Çocuk Bayramı', '2025-04-23', 1]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Emek ve Dayanışma Günü', '2025-05-01', 1]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ["Atatürk'ü Anma, Gençlik ve Spor Bayramı", '2025-05-19', 1]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Demokrasi ve Milli Birlik Günü', '2025-07-15', 1]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Zafer Bayramı', '2025-08-30', 1]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Cumhuriyet Bayramı', '2025-10-29', 1]);

    // 2025 Ramazan Bayramı (30 Mart - 1 Nisan)
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Ramazan Bayramı 1. Gün', '2025-03-30', 0]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Ramazan Bayramı 2. Gün', '2025-03-31', 0]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Ramazan Bayramı 3. Gün', '2025-04-01', 0]);

    // 2025 Kurban Bayramı (6-9 Haziran)
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Kurban Bayramı 1. Gün', '2025-06-06', 0]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Kurban Bayramı 2. Gün', '2025-06-07', 0]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Kurban Bayramı 3. Gün', '2025-06-08', 0]);
    db.run('INSERT INTO holidays (name, date, is_recurring) VALUES (?, ?, ?)', ['Kurban Bayramı 4. Gün', '2025-06-09', 0]);

    console.log('✅ Resmi tatiller eklendi');

    // ===============================
    // ÖRNEK PROGRAMLAR
    // ===============================
    // muh_temiz1 (id: 4) için Pazartesi-Çarşamba-Cuma programı
    // A101, A102, A103 odaları (id: 5, 6, 7)
    ['mon', 'wed', 'fri'].forEach(day => {
        db.run('INSERT INTO schedules (location_id, staff_id, day_of_week, valid_from, created_by) VALUES (?, ?, ?, ?, ?)',
            [5, 4, day, '2024-12-01', 2]); // A101
        db.run('INSERT INTO schedules (location_id, staff_id, day_of_week, valid_from, created_by) VALUES (?, ?, ?, ?, ?)',
            [6, 4, day, '2024-12-01', 2]); // A102
        db.run('INSERT INTO schedules (location_id, staff_id, day_of_week, valid_from, created_by) VALUES (?, ?, ?, ?, ?)',
            [7, 4, day, '2024-12-01', 2]); // A103
    });

    // muh_temiz2 (id: 5) için Salı-Perşembe programı
    // A201, A202 (id: 10, 11)
    ['tue', 'thu'].forEach(day => {
        db.run('INSERT INTO schedules (location_id, staff_id, day_of_week, valid_from, created_by) VALUES (?, ?, ?, ?, ?)',
            [10, 5, day, '2024-12-01', 2]); // A201
        db.run('INSERT INTO schedules (location_id, staff_id, day_of_week, valid_from, created_by) VALUES (?, ?, ?, ?, ?)',
            [11, 5, day, '2024-12-01', 2]); // A202
    });

    console.log('✅ Örnek programlar eklendi');

    // Veritabanını kaydet
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    db.close();
    console.log('\n🎉 Seed işlemi tamamlandı!\n');
    console.log('Giriş bilgileri:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Super Admin:    superadmin / super123');
    console.log('Fakülte Admin:  muh_admin / admin123');
    console.log('Supervisor:     muh_sup1 / super123');
    console.log('Personel:       muh_temiz1 / temiz123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seedDatabase().catch(err => {
    console.error('Seed işlemi sırasında hata:', err);
    process.exit(1);
});

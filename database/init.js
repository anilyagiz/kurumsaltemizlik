const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Data klasörünü oluştur
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kirikkale.db');

async function initDatabase() {
    // Eğer mevcut db varsa sil (development için)
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('🗑️  Eski veritabanı silindi');
    }

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    db.run('PRAGMA foreign_keys = ON');

    // Schema'yı oku ve çalıştır
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    db.exec(schema);
    console.log('✅ Veritabanı şeması oluşturuldu');

    // Veritabanını kaydet
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    db.close();
    console.log('🎉 Veritabanı hazır: ' + dbPath);
}

initDatabase().catch(err => {
    console.error('Veritabanı oluşturulurken hata:', err);
    process.exit(1);
});

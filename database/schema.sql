-- Kırıkkale Üniversitesi Temizlik Takip Sistemi
-- Veritabanı Şeması

-- Fakülteler
CREATE TABLE IF NOT EXISTS faculties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#1e40af',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kullanıcılar
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id INTEGER REFERENCES faculties(id),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('super_admin', 'faculty_admin', 'supervisor', 'staff')) NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Binalar
CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id INTEGER REFERENCES faculties(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(faculty_id, code)
);

-- Departmanlar/Katlar
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER REFERENCES buildings(id),
    name TEXT NOT NULL,
    floor TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lokasyonlar (Odalar)
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER REFERENCES departments(id),
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('room', 'toilet', 'corridor', 'lab', 'office', 'other')) DEFAULT 'room',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Haftalık Programlar
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER REFERENCES locations(id),
    staff_id INTEGER REFERENCES users(id),
    day_of_week TEXT CHECK(day_of_week IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')) NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Resmi Tatiller
CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    is_recurring INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Görevler
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER REFERENCES locations(id),
    assigned_to INTEGER REFERENCES users(id),
    schedule_id INTEGER REFERENCES schedules(id),
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'approved', 'rejected')) DEFAULT 'pending',
    priority TEXT CHECK(priority IN ('low', 'normal', 'high')) DEFAULT 'normal',
    notes TEXT,
    rejection_reason TEXT,
    due_date DATE,
    started_at DATETIME,
    completed_at DATETIME,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_users_faculty ON users(faculty_id);
CREATE INDEX IF NOT EXISTS idx_buildings_faculty ON buildings(faculty_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

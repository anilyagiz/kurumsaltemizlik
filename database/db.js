const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'kirikkale.db');

let db = null;
let SQL = null;

// Veritabanını senkron olarak başlat
async function initDatabase() {
    if (db) return;

    SQL = await initSqlJs();

    // Mevcut db dosyası varsa yükle
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
}

// Veritabanını kaydet
function saveDb() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// better-sqlite3 uyumlu wrapper
const dbWrapper = {
    prepare(sql) {
        return {
            run(...params) {
                if (params.length > 0) {
                    db.run(sql, params);
                } else {
                    db.run(sql);
                }
                saveDb();
                const lastId = db.exec("SELECT last_insert_rowid()");
                return {
                    lastInsertRowid: lastId[0]?.values[0]?.[0] || 0,
                    changes: db.getRowsModified()
                };
            },
            get(...params) {
                const stmt = db.prepare(sql);
                if (params.length > 0) {
                    stmt.bind(params);
                }
                if (stmt.step()) {
                    const columns = stmt.getColumnNames();
                    const values = stmt.get();
                    const row = {};
                    columns.forEach((col, i) => row[col] = values[i]);
                    stmt.free();
                    return row;
                }
                stmt.free();
                return undefined;
            },
            all(...params) {
                const results = [];
                const stmt = db.prepare(sql);
                if (params.length > 0) {
                    stmt.bind(params);
                }
                let columns = null;
                while (stmt.step()) {
                    if (!columns) {
                        columns = stmt.getColumnNames();
                    }
                    const values = stmt.get();
                    const row = {};
                    columns.forEach((col, i) => row[col] = values[i]);
                    results.push(row);
                }
                stmt.free();
                return results;
            }
        };
    },

    // Transaction durumu takibi
    _inTransaction: false,

    // Transaction desteği (better-sqlite3 uyumlu)
    transaction(fn) {
        const self = this;
        return (...args) => {
            // Zaten transaction içindeyse, direkt çalıştır (nested transaction)
            if (self._inTransaction) {
                return fn(...args);
            }

            try {
                db.exec('BEGIN TRANSACTION');
                self._inTransaction = true;
                const result = fn(...args);
                db.exec('COMMIT');
                self._inTransaction = false;
                saveDb();
                return result;
            } catch (error) {
                if (self._inTransaction) {
                    try {
                        db.exec('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('Rollback hatası:', rollbackError);
                    }
                    self._inTransaction = false;
                }
                throw error;
            }
        };
    },

    exec(sql) {
        db.exec(sql);
        saveDb();
    },

    pragma(pragmaStr) {
        db.run('PRAGMA ' + pragmaStr);
    },

    close() {
        saveDb();
        if (db) {
            db.close();
            db = null;
        }
    }
};

module.exports = dbWrapper;
module.exports.initDatabase = initDatabase;

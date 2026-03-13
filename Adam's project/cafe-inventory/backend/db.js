const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./inventory.db");

db.serialize(() => {
  db.run(`    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,  -- 'product' or 'consumable'
      unit TEXT NOT NULL,
      price REAL NOT NULL,
      max_quantity INTEGER NOT NULL,
      current_quantity INTEGER NOT NULL
    )
 `);

  db.run(`    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      type TEXT NOT NULL,  -- 'add', 'edit', 'delete', 'inbound', 'outbound'
      quantity INTEGER,
      username TEXT DEFAULT '',
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
 `);

  // Добавляем колонку username если её нет (миграция)
  db.run(`ALTER TABLE operations ADD COLUMN username TEXT DEFAULT ''`, (err) => {
    // Игнорируем ошибку если колонка уже существует
  });

  db.run(`    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      pin TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `, () => {
    // Вставляем админа по умолчанию, если его нет
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
      if (!row) {
        db.run('INSERT INTO users (username, pin, role) VALUES (?, ?, ?)', ['admin', '1234', 'admin']);
      }
    });
  });
});

module.exports = db;

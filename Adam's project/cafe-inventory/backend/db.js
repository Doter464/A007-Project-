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
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
 `);
});

module.exports = db;

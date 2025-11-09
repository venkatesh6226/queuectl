import sqlite3pkg from 'sqlite3';
const sqlite3 = sqlite3pkg.verbose();

const db = new sqlite3.Database('./queue.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      command TEXT,
      state TEXT CHECK(state IN ('pending','processing','completed','dead')),
      attempts INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      priority INTEGER DEFAULT 100,
      run_at TEXT,
      timeout_sec INTEGER,
      created_at TEXT,
      updated_at TEXT,
      last_error TEXT,
      last_output TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`INSERT OR IGNORE INTO config(key, value) VALUES ('max_retries', '3')`);
  db.run(`INSERT OR IGNORE INTO config(key, value) VALUES ('backoff_base', '2')`);
  db.run(`INSERT OR IGNORE INTO config(key, value) VALUES ('poll_interval_ms', '500')`);
  db.run(`INSERT OR IGNORE INTO config(key, value) VALUES ('default_timeout_sec', '0')`);
  db.run(`INSERT OR IGNORE INTO config(key, value) VALUES ('stop_all', '0')`);
});

export default db;
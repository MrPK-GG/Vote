const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.join(__dirname, 'data', 'voting.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    class TEXT NOT NULL,
    section TEXT NOT NULL,
    flag TEXT,
    profile_pic TEXT,
    vote_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS polling_booths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL UNIQUE,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    max_votes INTEGER DEFAULT NULL,
    auth_type TEXT DEFAULT 'pin',
    username TEXT UNIQUE DEFAULT NULL,
    password TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booth_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booth_id) REFERENCES polling_booths(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
  );

  CREATE TABLE IF NOT EXISTS vote_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booth_id INTEGER NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    voted_categories TEXT DEFAULT '[]',
    is_complete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booth_id) REFERENCES polling_booths(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Automated Schema Migrations
try { db.exec("ALTER TABLE polling_booths ADD COLUMN max_votes INTEGER DEFAULT NULL;"); } catch(e) {}
try { db.exec("ALTER TABLE polling_booths ADD COLUMN auth_type TEXT DEFAULT 'pin';"); } catch(e) {}
try { db.exec("ALTER TABLE polling_booths ADD COLUMN username TEXT DEFAULT NULL;"); } catch(e) {} // Note: no UNIQUE — SQLite ALTER TABLE doesn't support it
try { db.exec("ALTER TABLE polling_booths ADD COLUMN password TEXT DEFAULT NULL;"); } catch(e) {}

// Seed default settings
const defaultSettings = [
  ['vote_wait_seconds', '10'],
  ['show_public_results', 'false'],
  ['active_theme', 'royal-navy'],
  ['show_votes_left', 'false'],
  ['login_screen_type', 'pin'],
  ['election_phase', 'voting']
];
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
defaultSettings.forEach(([key, value]) => insertSetting.run(key, value));

// Seed default admin from .env
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get(adminUsername);
if (!existingAdmin) {
  const hashedPassword = bcrypt.hashSync(adminPassword, 10);
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(adminUsername, hashedPassword);
  console.log(`✅ Default admin created: ${adminUsername}`);
}

// Helper: log an admin action to the audit log
db.logAudit = function(adminUsername, action, details) {
  try {
    db.prepare('INSERT INTO audit_log (admin_username, action, details) VALUES (?, ?, ?)').run(
      adminUsername || 'system',
      action,
      details ? JSON.stringify(details) : null
    );
  } catch (e) { /* never crash on audit failure */ }
};

module.exports = db;
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(path.join(dataDir, 'data.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','owner','student')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS properties (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id INTEGER NOT NULL REFERENCES users(id),
 title TEXT NOT NULL, type TEXT NOT NULL, description TEXT NOT NULL,
 address TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
 contact_phone TEXT NOT NULL, monthly_price REAL NOT NULL,
 total_rooms INTEGER NOT NULL, available_rooms INTEGER NOT NULL,
 image_data TEXT, status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected')),
 rejection_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 property_id INTEGER NOT NULL REFERENCES properties(id),
 student_id INTEGER NOT NULL REFERENCES users(id),
 rooms INTEGER NOT NULL DEFAULT 1,
 move_in_date TEXT NOT NULL,
 message TEXT, status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','confirmed','rejected','cancelled','completed')),
 confirmed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 property_id INTEGER NOT NULL REFERENCES properties(id),
 booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
 student_id INTEGER NOT NULL REFERENCES users(id),
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
    `);
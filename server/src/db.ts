import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { createLogger } from './logger';

const log = createLogger('db');

let instance: Database.Database | null = null;

/** Opens (once) the SQLite database, enabling WAL + foreign keys. */
export function getDb(): Database.Database {
  if (instance) return instance;

  const dir = path.dirname(config.databasePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  instance = new Database(config.databasePath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  log.info(`SQLite ready at ${config.databasePath}`);
  return instance;
}

/**
 * Core schema shared across the app (auth). Module-specific tables are
 * created by each module's own `migrate()` so disabled modules never
 * touch the schema.
 */
export function migrateCore(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

/** Seeds the admin account from config if no admin exists yet. */
export function seedAdmin(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM admins').get() as { n: number };
  if (count.n > 0) return;
  const hash = bcrypt.hashSync(config.auth.adminPassword, 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(
    config.auth.adminUsername,
    hash,
  );
  log.info(`Seeded admin user "${config.auth.adminUsername}"`);
}

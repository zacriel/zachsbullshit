import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { Config } from './config';

/** Flat directory stats (file count + total bytes). */
function dirStats(dir: string): { path: string; files: number; bytes: number; exists: boolean } {
  if (!fs.existsSync(dir)) return { path: dir, files: 0, bytes: 0, exists: false };
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    files++;
    try {
      bytes += fs.statSync(path.join(dir, entry.name)).size;
    } catch {
      /* ignore unreadable file */
    }
  }
  return { path: dir, files, bytes, exists: true };
}

function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/**
 * Collects database internals and volume/disk usage for the admin System page.
 */
export function collectSystemInfo(db: Database.Database, config: Config) {
  // --- Database ---
  const pageSize = db.pragma('page_size', { simple: true }) as number;
  const pageCount = db.pragma('page_count', { simple: true }) as number;
  const freelist = db.pragma('freelist_count', { simple: true }) as number;
  const journalMode = db.pragma('journal_mode', { simple: true }) as string;

  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  const tables = tableRows.map((t) => {
    let rows = 0;
    try {
      rows = (db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number }).n;
    } catch {
      /* ignore */
    }
    return { name: t.name, rows };
  });

  const database = {
    path: config.databasePath,
    sizeBytes: fileSize(config.databasePath),
    walBytes: fileSize(`${config.databasePath}-wal`),
    shmBytes: fileSize(`${config.databasePath}-shm`),
    pageSize,
    pageCount,
    freelistCount: freelist,
    journalMode,
    tables,
    totalRows: tables.reduce((a, t) => a + t.rows, 0),
  };

  // --- Storage (on the volume) ---
  const protectedDir = path.join(path.dirname(config.uploadsPath), 'protected-files');
  const storage = {
    uploads: dirStats(config.uploadsPath),
    protectedFiles: dirStats(protectedDir),
  };

  // --- Disk / volume ---
  let disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number } | null = null;
  try {
    const s = fs.statfsSync(config.databasePath) as unknown as { bsize: number; blocks: number; bavail: number };
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    disk = { path: path.dirname(config.databasePath), totalBytes: total, freeBytes: free, usedBytes: total - free };
  } catch {
    disk = null;
  }

  // --- Runtime ---
  const mem = process.memoryUsage();
  const runtime = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    uptimeSec: Math.round(process.uptime()),
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
  };

  return { database, storage, disk, runtime, generatedAt: new Date().toISOString() };
}

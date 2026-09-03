import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import type { HubModule, ModuleContext } from '../../types';
import { pollServiceTiles, checkServiceTile } from './status';
import { createLogger } from '../../logger';

const log = createLogger('tiles');

/**
 * Dashboard module — the grid of tiles that makes up the site. Each tile has
 * a type, a free-form JSON config, and a grid position (x/y/w/h). Admins
 * arrange them in place; visitors see the saved layout. "service" tiles are
 * polled for live status (web + Minecraft).
 */

const TILE_TYPES = ['link', 'banner', 'service', 'project', 'text', 'heading', 'contact'] as const;

interface TileRow {
  id: number;
  type: string;
  config: string;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: number;
  sort_order: number;
  created_at: string;
}

interface StatusRow {
  tile_id: number;
  status: string;
  code: number | null;
  latency_ms: number | null;
  players_online: number | null;
  players_max: number | null;
  motd: string | null;
  version: string | null;
  checked_at: string;
}

const createSchema = z.object({
  type: z.enum(TILE_TYPES),
  config: z.record(z.any()).default({}),
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  w: z.number().int().min(1).max(12).default(3),
  h: z.number().int().min(1).max(24).default(2),
  enabled: z.boolean().default(true),
});

const updateSchema = z.object({
  config: z.record(z.any()).optional(),
  enabled: z.boolean().optional(),
  x: z.number().int().min(0).optional(),
  y: z.number().int().min(0).optional(),
  w: z.number().int().min(1).max(12).optional(),
  h: z.number().int().min(1).max(24).optional(),
});

const layoutSchema = z.object({
  layout: z.array(
    z.object({
      i: z.union([z.string(), z.number()]),
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      w: z.number().int().min(1).max(12),
      h: z.number().int().min(1).max(24),
    }),
  ),
});

function migrate({ db }: ModuleContext): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tiles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL,
      config     TEXT NOT NULL DEFAULT '{}',
      x          INTEGER NOT NULL DEFAULT 0,
      y          INTEGER NOT NULL DEFAULT 0,
      w          INTEGER NOT NULL DEFAULT 3,
      h          INTEGER NOT NULL DEFAULT 2,
      enabled    INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS service_status (
      tile_id        INTEGER PRIMARY KEY,
      status         TEXT,
      code           INTEGER,
      latency_ms     INTEGER,
      players_online INTEGER,
      players_max    INTEGER,
      motd           TEXT,
      version        TEXT,
      checked_at     TEXT
    );
  `);

  // Seed a starter layout only when completely empty.
  const count = (db.prepare('SELECT COUNT(*) AS n FROM tiles').get() as { n: number }).n;
  if (count === 0) seedTiles(db);
}

function seedTiles(db: import('better-sqlite3').Database): void {
  const insert = db.prepare(
    'INSERT INTO tiles (type, config, x, y, w, h, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const rows: [string, object, number, number, number, number, number][] = [
    ['banner', { title: 'zachsbullshit', subtitle: 'Everything I build, break, and host.', image_url: '', align: 'center' }, 0, 0, 12, 4, 0],
    ['heading', { text: 'Links', level: 2 }, 0, 4, 12, 1, 1],
    ['link', { label: 'GitHub', url: 'https://github.com', icon: 'github', description: 'Code & projects' }, 0, 5, 3, 2, 2],
    ['link', { label: 'Email', url: 'mailto:hello@banditchippers.com', icon: 'envelope', description: 'Get in touch' }, 3, 5, 3, 2, 3],
    ['heading', { text: 'Homelab', level: 2 }, 0, 7, 12, 1, 4],
    ['service', { name: 'Minecraft', kind: 'minecraft', host: 'mc.zachsbullshit.com', icon: 'cube' }, 0, 8, 4, 3, 5],
    ['contact', { title: 'Get in touch', subtitle: 'Questions, ideas, or just to say hi.' }, 4, 8, 6, 6, 6],
  ];
  const tx = db.transaction(() => rows.forEach((r) => insert.run(r[0], JSON.stringify(r[1]), r[2], r[3], r[4], r[5], r[6])));
  tx();
  log.info(`Seeded ${rows.length} starter tiles`);
}

function serialize(row: TileRow) {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row.config);
  } catch {
    config = {};
  }
  return { id: row.id, type: row.type, config, x: row.x, y: row.y, w: row.w, h: row.h, enabled: !!row.enabled };
}

function register(ctx: ModuleContext): Router {
  const { db, requireAuth } = ctx;
  const router = Router();

  // Image uploads for tile backgrounds — saved to the uploads volume.
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(ctx.config.uploadsPath)) fs.mkdirSync(ctx.config.uploadsPath, { recursive: true });
      cb(null, ctx.config.uploadsPath);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  });
  const ACCEPTED = (m: string) =>
    m.startsWith('image/') || m === 'video/mp4' || m === 'video/webm';
  const upload = multer({
    storage,
    limits: { fileSize: 64 * 1024 * 1024 }, // 64 MB (video-friendly)
    fileFilter: (_req, file, cb) => cb(null, ACCEPTED(file.mimetype)),
  });

  router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded (images or MP4/WebM video, under 64 MB)' });
      return;
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });

  // Public: enabled tiles + latest service statuses.
  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM tiles WHERE enabled = 1 ORDER BY y, x, id').all() as TileRow[];
    res.json({ tiles: rows.map(serialize) });
  });

  // Public: latest status snapshot for service tiles (up/down + players/MOTD).
  router.get('/status', (_req, res) => {
    const rows = db.prepare('SELECT * FROM service_status').all() as StatusRow[];
    const statuses: Record<number, Omit<StatusRow, 'tile_id'>> = {};
    for (const r of rows) {
      const { tile_id, ...rest } = r;
      statuses[tile_id] = rest;
    }
    res.json({ statuses });
  });

  // Admin: all tiles incl. disabled.
  router.get('/all', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT * FROM tiles ORDER BY y, x, id').all() as TileRow[];
    res.json({ tiles: rows.map(serialize) });
  });

  router.post('/', requireAuth, (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid tile', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const info = db
      .prepare('INSERT INTO tiles (type, config, x, y, w, h, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(d.type, JSON.stringify(d.config), d.x, d.y, d.w, d.h, d.enabled ? 1 : 0);
    const row = db.prepare('SELECT * FROM tiles WHERE id = ?').get(info.lastInsertRowid) as TileRow;
    res.status(201).json({ tile: serialize(row) });
  });

  // Save the whole grid layout at once (must precede "/:id").
  router.put('/layout', requireAuth, (req, res) => {
    const parsed = layoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid layout', details: parsed.error.flatten() });
      return;
    }
    const stmt = db.prepare('UPDATE tiles SET x = ?, y = ?, w = ?, h = ? WHERE id = ?');
    const tx = db.transaction(() => {
      for (const item of parsed.data.layout) {
        stmt.run(item.x, item.y, item.w, item.h, Number(item.i));
      }
    });
    tx();
    res.json({ ok: true });
  });

  router.put('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM tiles WHERE id = ?').get(id) as TileRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Tile not found' });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid tile', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    db.prepare(
      `UPDATE tiles SET
        config = COALESCE(@config, config),
        enabled = COALESCE(@enabled, enabled),
        x = COALESCE(@x, x), y = COALESCE(@y, y), w = COALESCE(@w, w), h = COALESCE(@h, h)
       WHERE id = @id`,
    ).run({
      id,
      config: d.config === undefined ? null : JSON.stringify(d.config),
      enabled: d.enabled === undefined ? null : d.enabled ? 1 : 0,
      x: d.x ?? null,
      y: d.y ?? null,
      w: d.w ?? null,
      h: d.h ?? null,
    });
    const row = db.prepare('SELECT * FROM tiles WHERE id = ?').get(id) as TileRow;
    // If a service tile changed, re-check it promptly.
    if (row.type === 'service') void checkServiceTile(db, row).catch(() => {});
    res.json({ tile: serialize(row) });
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM tiles WHERE id = ?').run(id);
    db.prepare('DELETE FROM service_status WHERE tile_id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Tile not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Admin: force a status re-check now.
  router.post('/status/refresh', requireAuth, async (_req, res) => {
    await pollServiceTiles(db);
    const rows = db.prepare('SELECT * FROM service_status').all() as StatusRow[];
    const statuses: Record<number, Omit<StatusRow, 'tile_id'>> = {};
    for (const r of rows) {
      const { tile_id, ...rest } = r;
      statuses[tile_id] = rest;
    }
    res.json({ statuses });
  });

  return router;
}

function start(ctx: ModuleContext): void {
  const run = () => pollServiceTiles(ctx.db).catch((err) => log.error('Status poll failed', err));
  setTimeout(run, 3000);
  setInterval(run, ctx.config.healthIntervalMs);
  log.info(`Service status poller every ${ctx.config.healthIntervalMs}ms`);
}

const dashboardModule: HubModule = {
  id: 'tiles',
  name: 'Dashboard',
  icon: 'table-cells-large',
  public: true,
  isEnabled: (c) => c.modules.tiles,
  migrate,
  register,
  start,
};

export default dashboardModule;

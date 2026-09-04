import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { HubModule, ModuleContext } from '../../types';
import { pollServiceTiles, checkServiceTile } from './status';
import { fetchFeed } from './feeds';
import { createLogger } from '../../logger';

const log = createLogger('tiles');

/**
 * Dashboard module — the grid of tiles that makes up the site. Each tile has
 * a type, a free-form JSON config, and a grid position (x/y/w/h). Admins
 * arrange them in place; visitors see the saved layout. "service" tiles are
 * polled for live status (web + Minecraft).
 */

const TILE_TYPES = [
  'link', 'banner', 'service', 'project', 'text', 'heading', 'contact',
  'icons', 'download', 'embed', 'command', 'clock', 'weather', 'rss', 'tabs',
] as const;

// "tabs" tiles are the page navigation. They're global (not owned by a single
// page) so they appear on every page and can switch between them.
const GLOBAL_TILE_TYPES = new Set<string>(['tabs']);

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
  page_id: number | null;
  created_at: string;
}

interface PageRow {
  id: number;
  name: string;
  slug: string;
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
  page_id: z.number().int().positive().optional(),
});

const pageSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()),
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
    CREATE TABLE IF NOT EXISTS download_secrets (
      tile_id       INTEGER PRIMARY KEY,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add the page_id column to existing tiles databases (pre-pages installs).
  const cols = db.prepare('PRAGMA table_info(tiles)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'page_id')) {
    db.exec('ALTER TABLE tiles ADD COLUMN page_id INTEGER');
  }

  // Ensure at least one page exists, then adopt any orphaned tiles onto it.
  const pageCount = (db.prepare('SELECT COUNT(*) AS n FROM pages').get() as { n: number }).n;
  if (pageCount === 0) {
    db.prepare('INSERT INTO pages (name, slug, sort_order) VALUES (?, ?, ?)').run('Home', 'home', 0);
  }
  const homeId = (db.prepare('SELECT id FROM pages ORDER BY sort_order, id LIMIT 1').get() as { id: number }).id;
  // Existing tiles (and any that predate pages) live on the first page — except
  // globals like the tabs nav, which stay unassigned so they show everywhere.
  db.prepare(
    `UPDATE tiles SET page_id = ? WHERE page_id IS NULL AND type NOT IN (${[...GLOBAL_TILE_TYPES].map(() => '?').join(',')})`,
  ).run(homeId, ...GLOBAL_TILE_TYPES);

  // Seed a starter layout only when completely empty.
  const count = (db.prepare('SELECT COUNT(*) AS n FROM tiles').get() as { n: number }).n;
  if (count === 0) seedTiles(db, homeId);
}

/** slugify a page name into a URL-safe, unique-ish slug. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'page'
  );
}

/** Pick a slug not already used by another page. */
function uniqueSlug(db: Database.Database, base: string): string {
  let slug = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/** Resolve a ?page query (id or slug) to a page id, defaulting to the first. */
function resolvePageId(db: Database.Database, q: unknown): number | null {
  const first = db.prepare('SELECT id FROM pages ORDER BY sort_order, id LIMIT 1').get() as { id: number } | undefined;
  if (q == null || q === '') return first?.id ?? null;
  const asNum = Number(q);
  if (Number.isInteger(asNum) && asNum > 0) {
    const hit = db.prepare('SELECT id FROM pages WHERE id = ?').get(asNum) as { id: number } | undefined;
    if (hit) return hit.id;
  }
  const bySlug = db.prepare('SELECT id FROM pages WHERE slug = ?').get(String(q)) as { id: number } | undefined;
  return bySlug?.id ?? first?.id ?? null;
}

function seedTiles(db: import('better-sqlite3').Database, pageId: number): void {
  const insert = db.prepare(
    'INSERT INTO tiles (type, config, x, y, w, h, sort_order, page_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
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
  const tx = db.transaction(() => rows.forEach((r) => insert.run(r[0], JSON.stringify(r[1]), r[2], r[3], r[4], r[5], r[6], pageId)));
  tx();
  log.info(`Seeded ${rows.length} starter tiles`);
}

function serialize(row: TileRow, admin = false) {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row.config);
  } catch {
    config = {};
  }
  // A download password is never returned to any client.
  delete config.password;
  // The internal storage handle for a protected file is hidden from visitors.
  if (!admin && row.type === 'download') delete config.file;
  return { id: row.id, type: row.type, config, x: row.x, y: row.y, w: row.w, h: row.h, enabled: !!row.enabled, page_id: row.page_id };
}

/**
 * Pulls a plaintext `password` out of a download tile's config (never stored
 * in the tile row). Returns the cleaned config plus the password intent:
 * `undefined` = unchanged, `''`/`null` = clear protection, string = set it.
 */
function extractPassword(type: string, config: Record<string, any>): { config: Record<string, any>; password: string | null | undefined } {
  if (type !== 'download' || !('password' in config)) return { config, password: undefined };
  const raw = config.password;
  const clean = { ...config };
  delete clean.password;
  if (raw === '' || raw == null) {
    clean.protected = false;
    return { config: clean, password: null };
  }
  clean.protected = true;
  return { config: clean, password: String(raw) };
}

function applyDownloadSecret(db: Database.Database, tileId: number, password: string | null | undefined): void {
  if (password === undefined) return;
  if (password === null || password === '') {
    db.prepare('DELETE FROM download_secrets WHERE tile_id = ?').run(tileId);
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT OR REPLACE INTO download_secrets (tile_id, password_hash) VALUES (?, ?)').run(tileId, hash);
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

  router.post('/upload', requireAuth, (req, res) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
        res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'File too large (max 64 MB)' : 'Upload error' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded (images or MP4/WebM video, under 64 MB)' });
        return;
      }
      res.status(201).json({ url: `/uploads/${req.file.filename}` });
    });
  });

  // Downloadable files live OUTSIDE the statically-served uploads dir so they
  // can't be fetched directly — only through the gated download route.
  const filesPath = path.join(path.dirname(ctx.config.uploadsPath), 'protected-files');
  const fileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(filesPath)) fs.mkdirSync(filesPath, { recursive: true });
      cb(null, filesPath);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  });
  const maxMb = ctx.config.uploadMaxMb;
  const uploadFile = multer({ storage: fileStorage, limits: { fileSize: maxMb * 1024 * 1024 } });

  // Admin: upload a downloadable file. Returns an opaque handle + display name.
  // The multer middleware is invoked manually so its errors become clean JSON
  // (a 413) instead of a reset connection.
  router.post('/upload-file', requireAuth, (req, res) => {
    uploadFile.single('file')(req, res, (err: unknown) => {
      if (err) {
        const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
        res.status(tooBig ? 413 : 400).json({
          error: tooBig ? `File too large (max ${maxMb} MB on the server; a proxy may cap it lower)` : 'Upload error',
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      res.status(201).json({ file: req.file.filename, filename: req.file.originalname, size: req.file.size });
    });
  });

  // Public: download a file tile, verifying the password when protected.
  router.post('/:id/download', (req, res) => {
    const id = Number(req.params.id);
    const tile = db.prepare('SELECT * FROM tiles WHERE id = ? AND enabled = 1').get(id) as TileRow | undefined;
    if (!tile || tile.type !== 'download') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    let cfg: { file?: string; filename?: string } = {};
    try {
      cfg = JSON.parse(tile.config);
    } catch {
      /* ignore */
    }
    if (!cfg.file) {
      res.status(404).json({ error: 'No file attached' });
      return;
    }
    const secret = db.prepare('SELECT password_hash FROM download_secrets WHERE tile_id = ?').get(id) as
      | { password_hash: string }
      | undefined;
    if (secret) {
      const password = String((req.body as { password?: string })?.password || '');
      if (!password || !bcrypt.compareSync(password, secret.password_hash)) {
        res.status(401).json({ error: 'Incorrect password' });
        return;
      }
    }
    const abs = path.join(filesPath, path.basename(cfg.file));
    if (!fs.existsSync(abs)) {
      res.status(404).json({ error: 'File missing' });
      return;
    }
    res.download(abs, cfg.filename || 'download');
  });

  // Public: current weather via Open-Meteo (no key). Cached briefly upstream.
  router.get('/weather', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'lat and lon required' });
      return;
    }
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius`;
      const r = await fetch(u);
      const data = await r.json();
      res.json({ weather: (data as { current?: unknown }).current ?? null });
    } catch {
      res.status(502).json({ error: 'Weather lookup failed' });
    }
  });

  // Admin: resolve a place name to coordinates (Open-Meteo geocoding).
  router.get('/geocode', requireAuth, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'q required' });
      return;
    }
    try {
      const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(u);
      const data = (await r.json()) as { results?: unknown[] };
      res.json({ results: data.results ?? [] });
    } catch {
      res.status(502).json({ error: 'Geocode failed' });
    }
  });

  // Public: fetch + parse this tile's configured RSS/Atom feed (cached).
  router.get('/:id/feed', async (req, res) => {
    const id = Number(req.params.id);
    const tile = db.prepare('SELECT * FROM tiles WHERE id = ? AND enabled = 1').get(id) as TileRow | undefined;
    if (!tile || tile.type !== 'rss') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    let cfg: { url?: string; count?: number } = {};
    try {
      cfg = JSON.parse(tile.config);
    } catch {
      /* ignore */
    }
    if (!cfg.url) {
      res.status(400).json({ error: 'No feed URL configured' });
      return;
    }
    try {
      const items = await fetchFeed(cfg.url, cfg.count || 6);
      res.json({ items });
    } catch {
      res.status(502).json({ error: 'Feed fetch failed' });
    }
  });

  // ---- Pages (tabs) ------------------------------------------------------
  // Public: the list of pages, ordered. Drives the tabs nav.
  router.get('/pages', (_req, res) => {
    const rows = db.prepare('SELECT id, name, slug, sort_order FROM pages ORDER BY sort_order, id').all() as PageRow[];
    res.json({ pages: rows });
  });

  // Admin: create a page.
  router.post('/pages', requireAuth, (req, res) => {
    const parsed = pageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid page', details: parsed.error.flatten() });
      return;
    }
    const slug = uniqueSlug(db, slugify(parsed.data.name));
    const nextOrder = ((db.prepare('SELECT MAX(sort_order) AS m FROM pages').get() as { m: number | null }).m ?? -1) + 1;
    const info = db.prepare('INSERT INTO pages (name, slug, sort_order) VALUES (?, ?, ?)').run(parsed.data.name, slug, nextOrder);
    const page = db.prepare('SELECT id, name, slug, sort_order FROM pages WHERE id = ?').get(info.lastInsertRowid) as PageRow;
    res.status(201).json({ page });
  });

  // Admin: reorder pages (must precede "/pages/:id").
  router.put('/pages/reorder', requireAuth, (req, res) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid order' });
      return;
    }
    const stmt = db.prepare('UPDATE pages SET sort_order = ? WHERE id = ?');
    const tx = db.transaction(() => parsed.data.ids.forEach((id, i) => stmt.run(i, id)));
    tx();
    res.json({ ok: true });
  });

  // Admin: rename a page (slug stays fixed so existing links keep working).
  router.put('/pages/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const parsed = pageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid page' });
      return;
    }
    const info = db.prepare('UPDATE pages SET name = ? WHERE id = ?').run(parsed.data.name, id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    const page = db.prepare('SELECT id, name, slug, sort_order FROM pages WHERE id = ?').get(id) as PageRow;
    res.json({ page });
  });

  // Admin: delete a page and every tile on it (never the last page).
  router.delete('/pages/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const total = (db.prepare('SELECT COUNT(*) AS n FROM pages').get() as { n: number }).n;
    if (total <= 1) {
      res.status(400).json({ error: 'Cannot delete the only page' });
      return;
    }
    const doomed = db.prepare('SELECT * FROM tiles WHERE page_id = ?').all(id) as TileRow[];
    const tx = db.transaction(() => {
      for (const t of doomed) {
        if (t.type === 'download') {
          try {
            const cfg = JSON.parse(t.config) as { file?: string };
            if (cfg.file) fs.rmSync(path.join(filesPath, path.basename(cfg.file)), { force: true });
          } catch {
            /* ignore */
          }
        }
        db.prepare('DELETE FROM service_status WHERE tile_id = ?').run(t.id);
        db.prepare('DELETE FROM download_secrets WHERE tile_id = ?').run(t.id);
      }
      db.prepare('DELETE FROM tiles WHERE page_id = ?').run(id);
      db.prepare('DELETE FROM pages WHERE id = ?').run(id);
    });
    tx();
    res.json({ ok: true });
  });

  // Public: enabled tiles for one page (+ globals like the tabs nav).
  router.get('/', (req, res) => {
    const pageId = resolvePageId(db, req.query.page);
    const rows = db
      .prepare('SELECT * FROM tiles WHERE enabled = 1 AND (page_id = ? OR page_id IS NULL) ORDER BY y, x, id')
      .all(pageId) as TileRow[];
    res.json({ tiles: rows.map((r) => serialize(r)) });
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

  // Admin: all tiles incl. disabled, for one page (+ globals).
  router.get('/all', requireAuth, (req, res) => {
    const pageId = resolvePageId(db, req.query.page);
    const rows = db
      .prepare('SELECT * FROM tiles WHERE page_id = ? OR page_id IS NULL ORDER BY y, x, id')
      .all(pageId) as TileRow[];
    res.json({ tiles: rows.map((r) => serialize(r, true)) });
  });

  router.post('/', requireAuth, (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid tile', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const { config: clean, password } = extractPassword(d.type, d.config);
    // Global tiles (the tabs nav) are unassigned so they appear on every page;
    // everything else belongs to the requested page, or the first page.
    const pageId = GLOBAL_TILE_TYPES.has(d.type) ? null : resolvePageId(db, d.page_id);
    const info = db
      .prepare('INSERT INTO tiles (type, config, x, y, w, h, enabled, page_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(d.type, JSON.stringify(clean), d.x, d.y, d.w, d.h, d.enabled ? 1 : 0, pageId);
    applyDownloadSecret(db, Number(info.lastInsertRowid), password);
    const row = db.prepare('SELECT * FROM tiles WHERE id = ?').get(info.lastInsertRowid) as TileRow;
    res.status(201).json({ tile: serialize(row, true) });
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
    let cleanConfig = d.config;
    let password: string | null | undefined;
    if (d.config !== undefined) {
      const ex = extractPassword(existing.type, d.config);
      cleanConfig = ex.config;
      password = ex.password;
    }
    db.prepare(
      `UPDATE tiles SET
        config = COALESCE(@config, config),
        enabled = COALESCE(@enabled, enabled),
        x = COALESCE(@x, x), y = COALESCE(@y, y), w = COALESCE(@w, w), h = COALESCE(@h, h)
       WHERE id = @id`,
    ).run({
      id,
      config: cleanConfig === undefined ? null : JSON.stringify(cleanConfig),
      enabled: d.enabled === undefined ? null : d.enabled ? 1 : 0,
      x: d.x ?? null,
      y: d.y ?? null,
      w: d.w ?? null,
      h: d.h ?? null,
    });
    applyDownloadSecret(db, id, password);
    const row = db.prepare('SELECT * FROM tiles WHERE id = ?').get(id) as TileRow;
    // If a service tile changed, re-check it promptly.
    if (row.type === 'service') void checkServiceTile(db, row).catch(() => {});
    res.json({ tile: serialize(row, true) });
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM tiles WHERE id = ?').get(id) as TileRow | undefined;
    // Remove an attached protected file, if any.
    if (existing?.type === 'download') {
      try {
        const cfg = JSON.parse(existing.config) as { file?: string };
        if (cfg.file) fs.rmSync(path.join(filesPath, path.basename(cfg.file)), { force: true });
      } catch {
        /* ignore */
      }
    }
    const info = db.prepare('DELETE FROM tiles WHERE id = ?').run(id);
    db.prepare('DELETE FROM service_status WHERE tile_id = ?').run(id);
    db.prepare('DELETE FROM download_secrets WHERE tile_id = ?').run(id);
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

import { Router, type Request, type RequestHandler, type Response } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { createLogger } from './logger';

const log = createLogger('golinks');

/**
 * "Go links" — a tiny URL shortener. Admins map a short slug to a destination
 * (e.g. /go/gh → https://github.com/...); visitors hitting /go/<slug> get a
 * 302 redirect, and each hit bumps a click counter.
 */

interface ShortLinkRow {
  id: number;
  slug: string;
  url: string;
  clicks: number;
  created_at: string;
}

const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

const linkSchema = z.object({
  slug: z.string().trim().regex(SLUG_RE, 'Slug: letters, numbers, - and _ only'),
  url: z
    .string()
    .trim()
    .refine((u) => /^(https?:\/\/|mailto:)/i.test(u), 'URL must start with http(s):// or mailto:'),
});

const updateSchema = linkSchema.partial();

export function migrateShortlinks(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS short_links (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      url        TEXT NOT NULL,
      clicks     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Admin CRUD for go-links, mounted at /api/shortlinks. */
export function createShortlinksRouter(db: Database.Database, requireAuth: RequestHandler): Router {
  const router = Router();

  router.get('/', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT * FROM short_links ORDER BY slug').all() as ShortLinkRow[];
    res.json({ links: rows });
  });

  router.post('/', requireAuth, (req, res) => {
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid link' });
      return;
    }
    const exists = db.prepare('SELECT 1 FROM short_links WHERE slug = ? COLLATE NOCASE').get(parsed.data.slug);
    if (exists) {
      res.status(409).json({ error: 'That slug is already taken' });
      return;
    }
    const info = db.prepare('INSERT INTO short_links (slug, url) VALUES (?, ?)').run(parsed.data.slug, parsed.data.url);
    const link = db.prepare('SELECT * FROM short_links WHERE id = ?').get(info.lastInsertRowid) as ShortLinkRow;
    res.status(201).json({ link });
  });

  router.put('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM short_links WHERE id = ?').get(id) as ShortLinkRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid link' });
      return;
    }
    const slug = parsed.data.slug ?? existing.slug;
    const url = parsed.data.url ?? existing.url;
    if (slug.toLowerCase() !== existing.slug.toLowerCase()) {
      const clash = db.prepare('SELECT 1 FROM short_links WHERE slug = ? COLLATE NOCASE AND id <> ?').get(slug, id);
      if (clash) {
        res.status(409).json({ error: 'That slug is already taken' });
        return;
      }
    }
    db.prepare('UPDATE short_links SET slug = ?, url = ? WHERE id = ?').run(slug, url, id);
    const link = db.prepare('SELECT * FROM short_links WHERE id = ?').get(id) as ShortLinkRow;
    res.json({ link });
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const info = db.prepare('DELETE FROM short_links WHERE id = ?').run(Number(req.params.id));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}

/** Public redirect handler for GET /go/:slug. */
export function createGoHandler(db: Database.Database): RequestHandler {
  return (req: Request, res: Response) => {
    const slug = String(req.params.slug || '');
    const row = db.prepare('SELECT * FROM short_links WHERE slug = ? COLLATE NOCASE').get(slug) as ShortLinkRow | undefined;
    if (!row) {
      res.status(404).type('text/plain').send('Short link not found');
      return;
    }
    try {
      db.prepare('UPDATE short_links SET clicks = clicks + 1 WHERE id = ?').run(row.id);
    } catch (err) {
      log.warn('Click count failed', err);
    }
    res.redirect(302, row.url);
  };
}

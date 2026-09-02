import { Router } from 'express';
import { z } from 'zod';
import type { HubModule, ModuleContext } from '../../types';

/**
 * Links module — the navigational hub grid. Public read of enabled links;
 * admin CRUD. Ordered by (sort_order, id).
 */

interface LinkRow {
  id: number;
  label: string;
  url: string;
  icon: string;
  description: string | null;
  category: string | null;
  sort_order: number;
  enabled: number;
  created_at: string;
}

const upsertSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().url().max(2048),
  icon: z.string().max(64).default('link'),
  description: z.string().max(400).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  sort_order: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

function migrate({ db }: ModuleContext): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      label       TEXT NOT NULL,
      url         TEXT NOT NULL,
      icon        TEXT NOT NULL DEFAULT 'link',
      description TEXT,
      category    TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function serialize(row: LinkRow) {
  return { ...row, enabled: !!row.enabled };
}

function register({ db, requireAuth }: ModuleContext): Router {
  const router = Router();

  // Public: enabled links only.
  router.get('/', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM links WHERE enabled = 1 ORDER BY sort_order, id')
      .all() as LinkRow[];
    res.json({ links: rows.map(serialize) });
  });

  // Admin: all links (incl. disabled).
  router.get('/all', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT * FROM links ORDER BY sort_order, id').all() as LinkRow[];
    res.json({ links: rows.map(serialize) });
  });

  router.post('/', requireAuth, (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid link', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const info = db
      .prepare(
        `INSERT INTO links (label, url, icon, description, category, sort_order, enabled)
         VALUES (@label, @url, @icon, @description, @category, @sort_order, @enabled)`,
      )
      .run({ ...d, description: d.description ?? null, category: d.category ?? null, enabled: d.enabled ? 1 : 0 });
    const row = db.prepare('SELECT * FROM links WHERE id = ?').get(info.lastInsertRowid) as LinkRow;
    res.status(201).json({ link: serialize(row) });
  });

  router.put('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid link', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    db.prepare(
      `UPDATE links SET
        label = COALESCE(@label, label),
        url = COALESCE(@url, url),
        icon = COALESCE(@icon, icon),
        description = COALESCE(@description, description),
        category = COALESCE(@category, category),
        sort_order = COALESCE(@sort_order, sort_order),
        enabled = COALESCE(@enabled, enabled)
       WHERE id = @id`,
    ).run({
      id,
      label: d.label ?? null,
      url: d.url ?? null,
      icon: d.icon ?? null,
      description: d.description ?? null,
      category: d.category ?? null,
      sort_order: d.sort_order ?? null,
      enabled: d.enabled === undefined ? null : d.enabled ? 1 : 0,
    });
    const row = db.prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow;
    res.json({ link: serialize(row) });
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const info = db.prepare('DELETE FROM links WHERE id = ?').run(Number(req.params.id));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}

const linksModule: HubModule = {
  id: 'links',
  name: 'Links',
  icon: 'compass',
  public: true,
  isEnabled: (c) => c.modules.links,
  migrate,
  register,
};

export default linksModule;

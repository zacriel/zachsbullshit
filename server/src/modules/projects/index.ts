import { Router } from 'express';
import { z } from 'zod';
import type { HubModule, ModuleContext } from '../../types';

/**
 * Projects module — portfolio showcase cards. Public read of enabled
 * projects; admin CRUD. `tags` stored as a JSON array string.
 */

interface ProjectRow {
  id: number;
  title: string;
  description: string | null;
  url: string | null;
  repo_url: string | null;
  tags: string;
  icon: string;
  image_url: string | null;
  sort_order: number;
  enabled: number;
  created_at: string;
}

const upsertSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  url: z.string().url().max(2048).optional().nullable().or(z.literal('')),
  repo_url: z.string().url().max(2048).optional().nullable().or(z.literal('')),
  tags: z.array(z.string().max(40)).max(20).default([]),
  icon: z.string().max(64).default('cube'),
  image_url: z.string().max(2048).optional().nullable().or(z.literal('')),
  sort_order: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

function migrate({ db }: ModuleContext): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      url         TEXT,
      repo_url    TEXT,
      tags        TEXT NOT NULL DEFAULT '[]',
      icon        TEXT NOT NULL DEFAULT 'cube',
      image_url   TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function serialize(row: ProjectRow) {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }
  return { ...row, tags, enabled: !!row.enabled };
}

function register({ db, requireAuth }: ModuleContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM projects WHERE enabled = 1 ORDER BY sort_order, id')
      .all() as ProjectRow[];
    res.json({ projects: rows.map(serialize) });
  });

  router.get('/all', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order, id').all() as ProjectRow[];
    res.json({ projects: rows.map(serialize) });
  });

  router.post('/', requireAuth, (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid project', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const info = db
      .prepare(
        `INSERT INTO projects (title, description, url, repo_url, tags, icon, image_url, sort_order, enabled)
         VALUES (@title, @description, @url, @repo_url, @tags, @icon, @image_url, @sort_order, @enabled)`,
      )
      .run({
        title: d.title,
        description: d.description ?? null,
        url: d.url || null,
        repo_url: d.repo_url || null,
        tags: JSON.stringify(d.tags),
        icon: d.icon,
        image_url: d.image_url || null,
        sort_order: d.sort_order,
        enabled: d.enabled ? 1 : 0,
      });
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid) as ProjectRow;
    res.status(201).json({ project: serialize(row) });
  });

  router.put('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid project', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    db.prepare(
      `UPDATE projects SET
        title = COALESCE(@title, title),
        description = COALESCE(@description, description),
        url = COALESCE(@url, url),
        repo_url = COALESCE(@repo_url, repo_url),
        tags = COALESCE(@tags, tags),
        icon = COALESCE(@icon, icon),
        image_url = COALESCE(@image_url, image_url),
        sort_order = COALESCE(@sort_order, sort_order),
        enabled = COALESCE(@enabled, enabled)
       WHERE id = @id`,
    ).run({
      id,
      title: d.title ?? null,
      description: d.description ?? null,
      url: d.url === undefined ? null : d.url || null,
      repo_url: d.repo_url === undefined ? null : d.repo_url || null,
      tags: d.tags ? JSON.stringify(d.tags) : null,
      icon: d.icon ?? null,
      image_url: d.image_url === undefined ? null : d.image_url || null,
      sort_order: d.sort_order ?? null,
      enabled: d.enabled === undefined ? null : d.enabled ? 1 : 0,
    });
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow;
    res.json({ project: serialize(row) });
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const info = db.prepare('DELETE FROM projects WHERE id = ?').run(Number(req.params.id));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}

const projectsModule: HubModule = {
  id: 'projects',
  name: 'Projects',
  icon: 'diagram-project',
  public: true,
  isEnabled: (c) => c.modules.projects,
  migrate,
  register,
};

export default projectsModule;

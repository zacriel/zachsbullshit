import { Router } from 'express';
import { z } from 'zod';
import type { HubModule, ModuleContext } from '../../types';

/**
 * Analytics module — records link clicks and exposes aggregates to admin.
 * Deliberately decoupled from the links module: it stores a numeric
 * `link_id` without a foreign key, so it works even if links is disabled.
 */

const clickSchema = z.object({
  linkId: z.number().int().positive(),
});

function migrate({ db }: ModuleContext): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clicks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id    INTEGER NOT NULL,
      referrer   TEXT,
      ua         TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks (link_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks (created_at);
  `);
}

function register({ db, requireAuth }: ModuleContext): Router {
  const router = Router();

  // Public: record a click. Fire-and-forget from the client.
  router.post('/click', (req, res) => {
    const parsed = clickSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid click' });
      return;
    }
    const referrer = (req.get('referer') || '').slice(0, 512) || null;
    const ua = (req.get('user-agent') || '').slice(0, 512) || null;
    db.prepare('INSERT INTO clicks (link_id, referrer, ua) VALUES (?, ?, ?)').run(
      parsed.data.linkId,
      referrer,
      ua,
    );
    res.status(202).json({ ok: true });
  });

  // Admin: aggregate summary.
  router.get('/summary', requireAuth, (_req, res) => {
    const total = (db.prepare('SELECT COUNT(*) AS n FROM clicks').get() as { n: number }).n;
    const perLink = db
      .prepare(
        `SELECT link_id, COUNT(*) AS count
         FROM clicks GROUP BY link_id ORDER BY count DESC`,
      )
      .all() as { link_id: number; count: number }[];
    const daily = db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS count
         FROM clicks
         WHERE created_at >= datetime('now', '-14 days')
         GROUP BY day ORDER BY day`,
      )
      .all() as { day: string; count: number }[];
    res.json({ total, perLink, daily });
  });

  return router;
}

const analyticsModule: HubModule = {
  id: 'analytics',
  name: 'Analytics',
  icon: 'chart-line',
  public: false,
  isEnabled: (c) => c.modules.analytics,
  migrate,
  register,
};

export default analyticsModule;

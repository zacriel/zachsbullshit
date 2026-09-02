import { Router } from 'express';
import { z } from 'zod';
import type { HubModule, ModuleContext } from '../../types';
import { createLogger } from '../../logger';

const log = createLogger('health');

/**
 * Health module — admin-defined services are pinged on an interval and
 * their latest status is cached in SQLite. Admin-facing only.
 */

interface ServiceRow {
  id: number;
  name: string;
  url: string;
  enabled: number;
  sort_order: number;
  last_status: string | null;
  last_code: number | null;
  last_latency_ms: number | null;
  last_checked: string | null;
  created_at: string;
}

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().max(2048),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

function migrate({ db }: ModuleContext): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      url             TEXT NOT NULL,
      enabled         INTEGER NOT NULL DEFAULT 1,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      last_status     TEXT,
      last_code       INTEGER,
      last_latency_ms INTEGER,
      last_checked    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Pings one service with a timeout and records the result. */
async function pingService(ctx: ModuleContext, svc: ServiceRow): Promise<void> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let status = 'down';
  let code: number | null = null;
  try {
    const resp = await fetch(svc.url, { method: 'GET', signal: controller.signal });
    code = resp.status;
    status = resp.ok ? 'up' : 'degraded';
  } catch {
    status = 'down';
  } finally {
    clearTimeout(timer);
  }
  const latency = Date.now() - started;
  ctx.db
    .prepare(
      `UPDATE services SET last_status = ?, last_code = ?, last_latency_ms = ?,
       last_checked = datetime('now') WHERE id = ?`,
    )
    .run(status, code, latency, svc.id);
}

async function pingAll(ctx: ModuleContext): Promise<void> {
  const services = ctx.db
    .prepare('SELECT * FROM services WHERE enabled = 1')
    .all() as ServiceRow[];
  await Promise.all(services.map((s) => pingService(ctx, s)));
}

function serialize(row: ServiceRow) {
  return { ...row, enabled: !!row.enabled };
}

function register(ctx: ModuleContext): Router {
  const { db, requireAuth } = ctx;
  const router = Router();

  // Admin: current status of all services.
  router.get('/services', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT * FROM services ORDER BY sort_order, id').all() as ServiceRow[];
    res.json({ services: rows.map(serialize) });
  });

  router.post('/services', requireAuth, (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid service', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const info = db
      .prepare('INSERT INTO services (name, url, enabled, sort_order) VALUES (?, ?, ?, ?)')
      .run(d.name, d.url, d.enabled ? 1 : 0, d.sort_order);
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid) as ServiceRow;
    res.status(201).json({ service: serialize(row) });
  });

  router.put('/services/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as ServiceRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid service', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    db.prepare(
      `UPDATE services SET
        name = COALESCE(@name, name),
        url = COALESCE(@url, url),
        enabled = COALESCE(@enabled, enabled),
        sort_order = COALESCE(@sort_order, sort_order)
       WHERE id = @id`,
    ).run({
      id,
      name: d.name ?? null,
      url: d.url ?? null,
      enabled: d.enabled === undefined ? null : d.enabled ? 1 : 0,
      sort_order: d.sort_order ?? null,
    });
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as ServiceRow;
    res.json({ service: serialize(row) });
  });

  router.delete('/services/:id', requireAuth, (req, res) => {
    const info = db.prepare('DELETE FROM services WHERE id = ?').run(Number(req.params.id));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Admin: trigger an immediate re-check.
  router.post('/check', requireAuth, async (_req, res) => {
    await pingAll(ctx);
    const rows = db.prepare('SELECT * FROM services ORDER BY sort_order, id').all() as ServiceRow[];
    res.json({ services: rows.map(serialize) });
  });

  return router;
}

function start(ctx: ModuleContext): void {
  const run = () => {
    pingAll(ctx).catch((err) => log.error('Ping cycle failed', err));
  };
  // First run shortly after boot, then on the configured interval.
  setTimeout(run, 3000);
  setInterval(run, ctx.config.healthIntervalMs);
  log.info(`Health poller every ${ctx.config.healthIntervalMs}ms`);
}

const healthModule: HubModule = {
  id: 'health',
  name: 'Health',
  icon: 'heart-pulse',
  public: false,
  isEnabled: (c) => c.modules.health,
  migrate,
  register,
  start,
};

export default healthModule;

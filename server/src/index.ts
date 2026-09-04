import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import { config, assertProductionSafety } from './config';
import { createLogger } from './logger';
import { getDb, migrateCore, seedAdmin } from './db';
import { createRequireAuth, createAuthRouter } from './auth/auth';
import { registerModules } from './modules/registry';
import { collectSystemInfo } from './system';
import { createFilesRouter } from './files';
import { migrateShortlinks, createShortlinksRouter, createGoHandler } from './shortlinks';
import type { ModuleContext } from './types';

const log = createLogger('server');

function main(): void {
  assertProductionSafety();

  const db = getDb();
  migrateCore(db);
  migrateShortlinks(db);
  seedAdmin(db);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security & parsing.
  app.use(
    helmet({
      contentSecurityPolicy: false, // SPA + FontAwesome CDN handled client-side
    }),
  );
  if (config.corsOrigin) {
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
  }
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // Basic API rate limit.
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }),
  );

  const requireAuth = createRequireAuth();
  const ctx: ModuleContext = { db, config, requireAuth };

  // Health probe for Railway.
  app.get('/api/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Auth is core (not a toggleable module).
  app.use('/api/auth', createAuthRouter(db, requireAuth));

  // Small key/value settings store. A few keys are readable by the public
  // (e.g. the header social icons); the rest require auth to read.
  const PUBLIC_SETTINGS = new Set(['header_icons']);
  app.get('/api/settings/:key', (req, res) => {
    const key = req.params.key;
    if (!PUBLIC_SETTINGS.has(key)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    let value: unknown = null;
    try {
      value = row ? JSON.parse(row.value) : null;
    } catch {
      value = null;
    }
    res.json({ key, value });
  });
  app.put('/api/settings/:key', requireAuth, (req, res) => {
    const value = JSON.stringify((req.body as { value?: unknown })?.value ?? null);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(req.params.key, value);
    res.json({ ok: true });
  });

  // Admin-only file manager for the volume.
  app.use('/api/files', createFilesRouter(db, config, requireAuth));

  // Go-links (URL shortener): admin CRUD under /api, public redirect at /go/*.
  app.use('/api/shortlinks', createShortlinksRouter(db, requireAuth));

  // Admin-only system diagnostics: database internals + volume/disk usage.
  app.get('/api/system', requireAuth, (_req, res) => {
    try {
      res.json(collectSystemInfo(db, config));
    } catch (err) {
      log.error('System info failed', err);
      res.status(500).json({ error: 'Could not collect system info' });
    }
  });

  // Mount enabled feature modules.
  const { apiRouter, enabled } = registerModules(ctx);
  app.use('/api', apiRouter);

  // 404 for unmatched API routes (before SPA fallback).
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Public go-links redirect: /go/<slug> → destination (302).
  app.get('/go/:slug', createGoHandler(db));

  // Serve uploaded images (persisted on the volume alongside the database).
  if (!fs.existsSync(config.uploadsPath)) fs.mkdirSync(config.uploadsPath, { recursive: true });
  app.use('/uploads', express.static(config.uploadsPath, { maxAge: '7d', immutable: true }));

  // Serve the built client in production (single-service deploy).
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
    log.info(`Serving client from ${config.clientDist}`);
  } else {
    log.warn(`Client build not found at ${config.clientDist} (dev mode or split deploy)`);
  }

  app.listen(config.port, () => {
    log.info(`Listening on :${config.port} (${config.isProd ? 'production' : 'development'})`);
    log.info(`Enabled modules: ${enabled.map((m) => m.id).join(', ') || 'none'}`);
  });
}

main();

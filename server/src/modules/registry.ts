import { Router } from 'express';
import type { HubModule, ModuleContext, ModuleManifestEntry } from '../types';
import { createLogger } from '../logger';

import dashboardModule from './dashboard';
import linksModule from './links';
import projectsModule from './projects';
import aboutModule from './about';
import contactModule from './contact';
import healthModule from './health';
import analyticsModule from './analytics';

const log = createLogger('registry');

/** Every module that exists in the codebase, enabled or not. */
const ALL_MODULES: HubModule[] = [
  dashboardModule,
  linksModule,
  projectsModule,
  aboutModule,
  contactModule,
  healthModule,
  analyticsModule,
];

export interface RegistryResult {
  /** Router mounting every enabled module under /api/<id>. */
  apiRouter: Router;
  /** Modules that were actually enabled and mounted. */
  enabled: HubModule[];
  /** Public-facing manifest for the frontend. */
  manifest: ModuleManifestEntry[];
}

/**
 * Mounts only the enabled modules. A disabled module never migrates its
 * schema, never mounts routes, and never appears in the manifest — so the
 * frontend, which reads the manifest, hides it gracefully.
 */
export function registerModules(ctx: ModuleContext): RegistryResult {
  const apiRouter = Router();
  const enabled: HubModule[] = [];

  for (const mod of ALL_MODULES) {
    if (!mod.isEnabled(ctx.config)) {
      log.info(`Module "${mod.id}" disabled — skipped`);
      continue;
    }
    try {
      mod.migrate?.(ctx);
      apiRouter.use(`/${mod.id}`, mod.register(ctx));
      mod.start?.(ctx);
      enabled.push(mod);
      log.info(`Module "${mod.id}" mounted at /api/${mod.id}`);
    } catch (err) {
      // One broken module must not take down the whole API.
      log.error(`Module "${mod.id}" failed to mount — skipping`, err);
    }
  }

  const manifest: ModuleManifestEntry[] = enabled.map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    public: m.public,
  }));

  // The manifest itself is a public endpoint so the SPA can self-configure.
  apiRouter.get('/modules', (_req, res) => res.json({ modules: manifest }));

  return { apiRouter, enabled, manifest };
}

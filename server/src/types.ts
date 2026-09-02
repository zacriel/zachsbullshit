import type { Router } from 'express';
import type Database from 'better-sqlite3';
import type { Config } from './config';

/**
 * Context handed to every module when it registers itself.
 * Modules receive the shared DB handle, resolved config, and the
 * `requireAuth` middleware so protected routes stay consistent.
 */
export interface ModuleContext {
  db: Database.Database;
  config: Config;
  requireAuth: import('express').RequestHandler;
}

/**
 * A module is a self-contained feature (links, projects, contact, …).
 * The registry mounts a module only when `isEnabled(config)` is true,
 * so a disabled module contributes no routes, no schema, no metadata.
 */
export interface HubModule {
  /** Stable identifier, also the API mount path: /api/<id>. */
  id: string;
  /** Human-readable name surfaced to the frontend. */
  name: string;
  /** FontAwesome icon name (without the `fa-` prefix) for the frontend. */
  icon: string;
  /** Whether this module renders a public section in the UI. */
  public: boolean;
  /** Reads the config flag that turns this module on/off. */
  isEnabled: (config: Config) => boolean;
  /** Optional: create tables / seed rows. Called once at boot if enabled. */
  migrate?: (ctx: ModuleContext) => void;
  /** Builds and returns the router mounted at /api/<id>. */
  register: (ctx: ModuleContext) => Router;
  /** Optional: long-running work (timers, pollers) started at boot. */
  start?: (ctx: ModuleContext) => void;
}

/** Shape advertised at GET /api/modules so the frontend renders only what exists. */
export interface ModuleManifestEntry {
  id: string;
  name: string;
  icon: string;
  public: boolean;
}

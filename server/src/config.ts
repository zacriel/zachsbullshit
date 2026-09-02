import dotenv from 'dotenv';
import path from 'path';

// Single canonical .env at the repo root (../../ from both src and dist).
// Real environment variables (e.g. on Railway) always take precedence.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/** Parse a boolean-ish env var. Defaults ON unless explicitly "false"/"0". */
function flag(value: string | undefined, fallback = true): boolean {
  if (value === undefined) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const isProd = process.env.NODE_ENV === 'production';

export interface Config {
  isProd: boolean;
  port: number;
  databasePath: string;
  clientDist: string;
  corsOrigin: string | undefined;
  auth: {
    adminUsername: string;
    adminPassword: string;
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  modules: Record<string, boolean>;
  healthIntervalMs: number;
  uploadsPath: string;
}

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'data', 'hub.sqlite');

// Uploaded images sit next to the database so they persist on the same
// Railway volume. Override with UPLOADS_PATH if needed.
const uploadsPath = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(path.dirname(databasePath), 'uploads');

export const config: Config = {
  isProd,
  port: int(process.env.PORT, 4000),
  databasePath,
  // In prod the compiled server lives in server/dist, so the client build
  // is two levels up. Override with CLIENT_DIST for split deployments.
  clientDist: process.env.CLIENT_DIST
    ? path.resolve(process.env.CLIENT_DIST)
    : path.resolve(__dirname, '..', '..', 'client', 'dist'),
  corsOrigin: process.env.CORS_ORIGIN || undefined,
  auth: {
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'change-me-now',
    jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  modules: {
    // The tile dashboard is the primary content system.
    tiles: flag(process.env.MODULE_TILES),
    analytics: flag(process.env.MODULE_ANALYTICS),
    // Contact backs the contact tile.
    contact: flag(process.env.MODULE_CONTACT),
    // Legacy section modules — superseded by tiles, off unless explicitly enabled.
    links: flag(process.env.MODULE_LINKS, false),
    projects: flag(process.env.MODULE_PROJECTS, false),
    about: flag(process.env.MODULE_ABOUT, false),
    health: flag(process.env.MODULE_HEALTH, false),
  },
  healthIntervalMs: int(process.env.HEALTH_INTERVAL_MS, 60000),
  uploadsPath,
};

/** Fail fast on insecure production config. */
export function assertProductionSafety(): void {
  if (!isProd) return;
  const problems: string[] = [];
  if (config.auth.jwtSecret.includes('dev-only')) problems.push('JWT_SECRET is unset');
  if (config.auth.adminPassword === 'change-me-now') problems.push('ADMIN_PASSWORD is default');
  if (problems.length) {
    // eslint-disable-next-line no-console
    console.warn(`[config] WARNING — insecure production settings: ${problems.join(', ')}`);
  }
}

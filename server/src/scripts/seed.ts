/**
 * Seed script. Running module migrations creates the tables and, on a fresh
 * database, the dashboard module seeds a starter set of tiles automatically.
 * Safe to run repeatedly — nothing is inserted when data already exists.
 * Usage: npm run seed
 */
import { getDb, migrateCore, seedAdmin } from '../db';
import { registerModules } from '../modules/registry';
import { config } from '../config';
import { createRequireAuth } from '../auth/auth';
import { createLogger } from '../logger';

const log = createLogger('seed');

function main(): void {
  const db = getDb();
  migrateCore(db);
  seedAdmin(db);
  // Running the registry migrates all enabled modules; the dashboard module
  // seeds starter tiles when the tiles table is empty.
  registerModules({ db, config, requireAuth: createRequireAuth() });

  const tiles = (db.prepare('SELECT COUNT(*) AS n FROM tiles').get() as { n: number }).n;
  log.info(`Seed complete — ${tiles} tile(s) in the dashboard`);
  process.exit(0);
}

main();

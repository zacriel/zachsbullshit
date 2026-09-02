import type Database from 'better-sqlite3';
import { pingMinecraft } from './mcping';
import { createLogger } from '../../logger';

const log = createLogger('status');

/**
 * Status checking for "service" tiles. Web services get an HTTP probe;
 * Minecraft services get a native Server List Ping. Latest results are
 * cached in the `service_status` table.
 */

interface TileRow {
  id: number;
  type: string;
  config: string;
  enabled: number;
}

interface ServiceConfig {
  kind?: 'web' | 'minecraft';
  host?: string;
  url?: string;
  port?: number;
}

async function checkWeb(url: string): Promise<{ status: string; code: number | null; latency: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    return { status: resp.ok ? 'up' : 'degraded', code: resp.status, latency: Date.now() - started };
  } catch {
    return { status: 'down', code: null, latency: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** Runs the appropriate probe for one service tile and persists the result. */
export async function checkServiceTile(db: Database.Database, tile: TileRow): Promise<void> {
  let cfg: ServiceConfig = {};
  try {
    cfg = JSON.parse(tile.config) as ServiceConfig;
  } catch {
    cfg = {};
  }

  let status = 'down';
  let latency: number | null = null;
  let code: number | null = null;
  let playersOnline: number | null = null;
  let playersMax: number | null = null;
  let motd: string | null = null;
  let version: string | null = null;

  if (cfg.kind === 'minecraft') {
    const host = cfg.host || cfg.url || '';
    const res = host ? await pingMinecraft(host, cfg.port) : { online: false };
    status = res.online ? 'up' : 'down';
    latency = res.latencyMs ?? null;
    playersOnline = res.players?.online ?? null;
    playersMax = res.players?.max ?? null;
    motd = res.motd ?? null;
    version = res.version ?? null;
  } else {
    const url = cfg.url || cfg.host || '';
    if (url) {
      const res = await checkWeb(url);
      status = res.status;
      latency = res.latency;
      code = res.code;
    }
  }

  db.prepare(
    `INSERT INTO service_status (tile_id, status, code, latency_ms, players_online, players_max, motd, version, checked_at)
     VALUES (@tile_id, @status, @code, @latency, @po, @pm, @motd, @version, datetime('now'))
     ON CONFLICT(tile_id) DO UPDATE SET
       status=@status, code=@code, latency_ms=@latency, players_online=@po,
       players_max=@pm, motd=@motd, version=@version, checked_at=datetime('now')`,
  ).run({
    tile_id: tile.id,
    status,
    code,
    latency,
    po: playersOnline,
    pm: playersMax,
    motd,
    version,
  });
}

/** Checks every enabled service tile. */
export async function pollServiceTiles(db: Database.Database): Promise<void> {
  const tiles = db
    .prepare("SELECT id, type, config, enabled FROM tiles WHERE type = 'service' AND enabled = 1")
    .all() as TileRow[];
  await Promise.all(tiles.map((t) => checkServiceTile(db, t).catch(() => {})));
  if (tiles.length) log.debug(`Checked ${tiles.length} service tile(s)`);
}

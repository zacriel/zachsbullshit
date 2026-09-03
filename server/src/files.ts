import { Router, type RequestHandler } from 'express';
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { Config } from './config';

/**
 * Admin file manager for the volume: lists uploaded media and protected
 * download files, flags which are referenced by a tile (vs. orphaned), and
 * allows download / delete. Mounted at /api/files.
 */

type Store = 'uploads' | 'protected';

interface FileItem {
  store: Store;
  name: string;
  sizeBytes: number;
  modified: string;
  type: 'image' | 'video' | 'file';
  url: string | null; // public URL for media; null for protected files
  used: boolean;
}

function extOf(name: string): string {
  return path.extname(name).toLowerCase().replace('.', '');
}
function kindOf(ext: string): FileItem['type'] {
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext)) return 'video';
  return 'file';
}

export function createFilesRouter(db: Database.Database, config: Config, requireAuth: RequestHandler): Router {
  const router = Router();
  const uploadsDir = config.uploadsPath;
  const protectedDir = path.join(path.dirname(config.uploadsPath), 'protected-files');

  /** Which stored files are referenced by a tile's config. */
  function referenced(): { uploads: Set<string>; protectedFiles: Set<string> } {
    const uploads = new Set<string>();
    const protectedFiles = new Set<string>();
    let rows: { config: string; type: string }[] = [];
    try {
      rows = db.prepare('SELECT config, type FROM tiles').all() as { config: string; type: string }[];
    } catch {
      return { uploads, protectedFiles };
    }
    for (const r of rows) {
      let cfg: Record<string, unknown> = {};
      try {
        cfg = JSON.parse(r.config);
      } catch {
        continue;
      }
      // Any string value that points at /uploads/<name> marks that media used.
      for (const v of Object.values(cfg)) {
        const scan = (s: unknown) => {
          if (typeof s !== 'string') return;
          const m = s.match(/\/uploads\/([^"'\s?]+)/);
          if (m) uploads.add(m[1]);
        };
        if (Array.isArray(v)) v.forEach(scan);
        else scan(v);
      }
      if (r.type === 'download' && typeof cfg.file === 'string' && cfg.file) {
        protectedFiles.add(path.basename(cfg.file));
      }
    }
    return { uploads, protectedFiles };
  }

  function listDir(dir: string, store: Store, ref: ReturnType<typeof referenced>): FileItem[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => {
        const st = fs.statSync(path.join(dir, e.name));
        const type = kindOf(extOf(e.name));
        return {
          store,
          name: e.name,
          sizeBytes: st.size,
          modified: st.mtime.toISOString(),
          type,
          url: store === 'uploads' ? `/uploads/${e.name}` : null,
          used: store === 'uploads' ? ref.uploads.has(e.name) : ref.protectedFiles.has(e.name),
        };
      })
      .sort((a, b) => b.modified.localeCompare(a.modified));
  }

  router.get('/', requireAuth, (_req, res) => {
    const ref = referenced();
    const files = [...listDir(uploadsDir, 'uploads', ref), ...listDir(protectedDir, 'protected', ref)];
    const totalBytes = files.reduce((a, f) => a + f.sizeBytes, 0);
    res.json({ files, totalBytes });
  });

  // Admin download of a protected file (public route is per-tile + password).
  router.get('/protected/:name', requireAuth, (req, res) => {
    const name = path.basename(req.params.name);
    const abs = path.join(protectedDir, name);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.download(abs, name);
  });

  router.delete('/:store/:name', requireAuth, (req, res) => {
    const store = req.params.store as Store;
    const dir = store === 'uploads' ? uploadsDir : store === 'protected' ? protectedDir : null;
    if (!dir) {
      res.status(400).json({ error: 'Unknown store' });
      return;
    }
    const abs = path.join(dir, path.basename(req.params.name));
    if (!fs.existsSync(abs)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    try {
      fs.rmSync(abs, { force: true });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  return router;
}

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';

interface SystemInfo {
  database: {
    path: string;
    sizeBytes: number;
    walBytes: number;
    shmBytes: number;
    pageSize: number;
    pageCount: number;
    freelistCount: number;
    journalMode: string;
    tables: { name: string; rows: number }[];
    totalRows: number;
  };
  storage: {
    uploads: { path: string; files: number; bytes: number; exists: boolean };
    protectedFiles: { path: string; files: number; bytes: number; exists: boolean };
  };
  disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number } | null;
  runtime: {
    node: string;
    platform: string;
    arch: string;
    uptimeSec: number;
    rssBytes: number;
    heapUsedBytes: number;
    pid: number;
    env: string;
  };
  generatedAt: string;
}

function bytes(n: number): string {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function duration(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export function SystemAdmin({ notify }: { notify: (m: string, e?: boolean) => void }) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    api
      .get<SystemInfo>('/system')
      .then((r) => {
        setInfo(r);
        setFailed(false);
      })
      .catch(() => {
        setFailed(true);
        notify('Could not load system info', true);
      })
      .finally(() => setBusy(false));
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) return <div className="empty">Couldn't load system info.</div>;
  if (!info) return <div className="empty">Loading…</div>;

  const d = info.database;
  const diskPct = info.disk ? Math.min(100, Math.round((info.disk.usedBytes / info.disk.totalBytes) * 100)) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={busy}>
          <Icon name="rotate" spin={busy} /> Refresh
        </button>
      </div>

      <div className="sys-grid">
        {/* Disk / volume */}
        <div className="sys-card">
          <div className="sys-card__title"><Icon name="hard-drive" /> Volume / disk</div>
          {info.disk ? (
            <>
              <div className="sys-bar">
                <div className="sys-bar__fill" style={{ width: `${diskPct}%` }} />
              </div>
              <div className="sys-kv"><span>Used</span><b>{bytes(info.disk.usedBytes)} ({diskPct}%)</b></div>
              <div className="sys-kv"><span>Free</span><b>{bytes(info.disk.freeBytes)}</b></div>
              <div className="sys-kv"><span>Total</span><b>{bytes(info.disk.totalBytes)}</b></div>
              <div className="sys-kv"><span>Mount</span><code>{info.disk.path}</code></div>
            </>
          ) : (
            <div className="admin-row__muted">Disk stats unavailable on this platform.</div>
          )}
        </div>

        {/* Runtime */}
        <div className="sys-card">
          <div className="sys-card__title"><Icon name="microchip" /> Runtime</div>
          <div className="sys-kv"><span>Environment</span><b>{info.runtime.env}</b></div>
          <div className="sys-kv"><span>Node</span><b>{info.runtime.node}</b></div>
          <div className="sys-kv"><span>Platform</span><b>{info.runtime.platform} / {info.runtime.arch}</b></div>
          <div className="sys-kv"><span>Uptime</span><b>{duration(info.runtime.uptimeSec)}</b></div>
          <div className="sys-kv"><span>Memory (RSS)</span><b>{bytes(info.runtime.rssBytes)}</b></div>
        </div>

        {/* Storage */}
        <div className="sys-card">
          <div className="sys-card__title"><Icon name="folder-open" /> Uploaded media</div>
          <div className="sys-kv"><span>Files</span><b>{info.storage.uploads.files}</b></div>
          <div className="sys-kv"><span>Size</span><b>{bytes(info.storage.uploads.bytes)}</b></div>
          <div className="sys-kv"><span>Path</span><code>{info.storage.uploads.path}</code></div>
          <hr className="sys-hr" />
          <div className="sys-card__title" style={{ fontSize: '0.9rem' }}><Icon name="lock" /> Protected files</div>
          <div className="sys-kv"><span>Files</span><b>{info.storage.protectedFiles.files}</b></div>
          <div className="sys-kv"><span>Size</span><b>{bytes(info.storage.protectedFiles.bytes)}</b></div>
        </div>

        {/* Database */}
        <div className="sys-card">
          <div className="sys-card__title"><Icon name="database" /> Database</div>
          <div className="sys-kv"><span>File size</span><b>{bytes(d.sizeBytes)}</b></div>
          <div className="sys-kv"><span>WAL / SHM</span><b>{bytes(d.walBytes)} / {bytes(d.shmBytes)}</b></div>
          <div className="sys-kv"><span>Journal mode</span><b>{d.journalMode}</b></div>
          <div className="sys-kv"><span>Pages</span><b>{d.pageCount.toLocaleString()} × {d.pageSize} B</b></div>
          <div className="sys-kv"><span>Free pages</span><b>{d.freelistCount.toLocaleString()}</b></div>
          <div className="sys-kv"><span>Path</span><code>{d.path}</code></div>
        </div>
      </div>

      {/* Tables */}
      <div className="sys-card" style={{ marginTop: 16 }}>
        <div className="sys-card__title"><Icon name="table" /> Tables ({d.totalRows.toLocaleString()} rows total)</div>
        <div className="sys-table-wrap">
          <table className="sys-table">
            <thead>
              <tr><th>Table</th><th style={{ textAlign: 'right' }}>Rows</th></tr>
            </thead>
            <tbody>
              {d.tables.map((t) => (
                <tr key={t.name}>
                  <td><code>{t.name}</code></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.rows.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="admin-row__muted" style={{ marginTop: 12, fontSize: '0.78rem' }}>
        Snapshot at {new Date(info.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}

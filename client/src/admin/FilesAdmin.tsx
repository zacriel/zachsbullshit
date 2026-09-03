import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '../api';
import { Icon } from '../components/Icon';

interface FileItem {
  store: 'uploads' | 'protected';
  name: string;
  sizeBytes: number;
  modified: string;
  type: 'image' | 'video' | 'file';
  url: string | null;
  used: boolean;
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

type Filter = 'all' | 'media' | 'protected' | 'orphaned';

export function FilesAdmin({ notify }: { notify: (m: string, e?: boolean) => void }) {
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ files: FileItem[]; totalBytes: number }>('/files')
      .then((r) => {
        setFiles(r.files);
        setTotal(r.totalBytes);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(f: FileItem) {
    const warn = f.used ? '\n\nThis file is IN USE by a tile — deleting it will break that tile.' : '';
    if (!confirm(`Delete ${f.name}?${warn}`)) return;
    try {
      await api.del(`/files/${f.store}/${encodeURIComponent(f.name)}`);
      setFiles((prev) => (prev ? prev.filter((x) => !(x.store === f.store && x.name === f.name)) : prev));
      notify('Deleted');
    } catch {
      notify('Delete failed', true);
    }
  }

  async function download(f: FileItem) {
    if (f.store === 'uploads' && f.url) {
      window.open(f.url, '_blank');
      return;
    }
    // Protected files need an authenticated request.
    try {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const resp = await fetch(`/api/files/protected/${encodeURIComponent(f.name)}`, { headers, credentials: 'include' });
      if (!resp.ok) {
        notify('Download failed', true);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('Download failed', true);
    }
  }

  if (failed) return <div className="empty">Couldn't load files.</div>;
  if (!files) return <div className="empty">Loading…</div>;

  const shown = files.filter((f) => {
    if (filter === 'media') return f.store === 'uploads';
    if (filter === 'protected') return f.store === 'protected';
    if (filter === 'orphaned') return !f.used;
    return true;
  });
  const orphans = files.filter((f) => !f.used).length;

  return (
    <div>
      <div className="files-toolbar">
        <div className="files-filters">
          {(['all', 'media', 'protected', 'orphaned'] as Filter[]).map((f) => (
            <button key={f} className={`admin-tab ${filter === f ? 'admin-tab--active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'media' ? 'Media' : f === 'protected' ? 'Protected' : `Orphaned${orphans ? ` (${orphans})` : ''}`}
            </button>
          ))}
        </div>
        <span className="admin-row__muted" style={{ fontSize: '0.82rem' }}>
          {files.length} files · {bytes(total)}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="empty">No files here.</div>
      ) : (
        <div className="files-grid">
          {shown.map((f) => (
            <div key={f.store + f.name} className="file-card">
              <div className="file-card__thumb">
                {f.type === 'image' && f.url ? (
                  <img src={f.url} alt="" loading="lazy" />
                ) : f.type === 'video' && f.url ? (
                  <video src={f.url} muted loop playsInline />
                ) : (
                  <Icon name={f.type === 'video' ? 'film' : f.store === 'protected' ? 'file-zipper' : 'file'} />
                )}
                {!f.used && <span className="file-card__orphan" title="Not referenced by any tile">orphan</span>}
                {f.store === 'protected' && <span className="file-card__lock" title="Protected file"><Icon name="lock" /></span>}
              </div>
              <div className="file-card__body">
                <div className="file-card__name" title={f.name}>{f.name}</div>
                <div className="file-card__meta">{bytes(f.sizeBytes)} · {new Date(f.modified).toLocaleDateString()}</div>
                <div className="file-card__actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => download(f)} title="Download / open">
                    <Icon name={f.store === 'uploads' ? 'up-right-from-square' : 'download'} />
                  </button>
                  <button className="btn btn--danger btn--sm" onClick={() => remove(f)} title="Delete">
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

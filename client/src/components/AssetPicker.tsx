import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from './Icon';

export interface AssetItem {
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

/**
 * Modal that lists every asset already on the volume so a tile can reuse one
 * instead of re-uploading — including orphaned files not referenced anywhere.
 * `kind` picks the relevant store: media (images/video in /uploads) or the
 * downloadable files kept in the protected store.
 */
export function AssetPicker({
  kind,
  onPick,
  onClose,
}: {
  kind: 'media' | 'file';
  onPick: (a: AssetItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<AssetItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    api
      .get<{ files: AssetItem[] }>('/files')
      .then((r) => setItems(r.files))
      .catch(() => setFailed(true));
  }, []);

  const shown = (items || [])
    .filter((f) => (kind === 'media' ? f.store === 'uploads' : f.store === 'protected'))
    .filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()));

  function choose(f: AssetItem) {
    onPick(f);
    onClose();
  }

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal--editor" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="section__icon"><Icon name={kind === 'media' ? 'photo-film' : 'folder-open'} /></span>
          <h2 style={{ fontSize: '1.2rem' }}>{kind === 'media' ? 'Choose an image or video' : 'Choose a file'}</h2>
        </div>

        <div className="modal__body">
          <input
            className="input"
            style={{ marginBottom: 14 }}
            placeholder="Search by filename…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {failed ? (
            <div className="empty">Couldn't load assets.</div>
          ) : !items ? (
            <div className="center-state"><span className="spinner" /></div>
          ) : shown.length === 0 ? (
            <div className="empty">No {kind === 'media' ? 'images or videos' : 'files'} on the volume yet.</div>
          ) : (
            <div className="asset-grid">
              {shown.map((f) => (
                <button key={f.store + f.name} type="button" className="asset-card" onClick={() => choose(f)} title={f.name}>
                  <div className="asset-card__thumb">
                    {f.type === 'image' && f.url ? (
                      <img src={f.url} alt="" loading="lazy" />
                    ) : f.type === 'video' && f.url ? (
                      <video src={f.url} muted playsInline />
                    ) : (
                      <Icon name={f.type === 'video' ? 'film' : f.store === 'protected' ? 'file-zipper' : 'file'} />
                    )}
                    {!f.used && <span className="asset-card__badge" title="Not referenced by any tile">orphan</span>}
                  </div>
                  <div className="asset-card__name">{f.name}</div>
                  <div className="asset-card__meta">{bytes(f.sizeBytes)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="modal__foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

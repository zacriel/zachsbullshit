import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { uploadImage } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { IconPicker } from '../components/IconPicker';
import { isVideo } from './media';
import type { Tile } from '../types';

/** Modal editor for a tile's type-specific configuration. */
export function TileEditor({
  tile,
  onSave,
  onDelete,
  onClose,
}: {
  tile: Tile;
  onSave: (config: Record<string, any>, enabled: boolean, w?: number, h?: number) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { notify } = useAuth();
  const [config, setConfig] = useState<Record<string, any>>({ ...tile.config });
  const [enabled, setEnabled] = useState(tile.enabled);
  const [w, setW] = useState(tile.w || 3);
  const [h, setH] = useState(tile.h || 2);

  const set = (key: string, value: unknown) => setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span className="section__icon"><Icon name="pen-to-square" /></span>
          <h2 style={{ fontSize: '1.2rem', textTransform: 'capitalize' }}>{tile.type} tile</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tile.type === 'banner' && (
            <>
              <Field label="Title"><input className="input" value={config.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
              <Field label="Subtitle"><input className="input" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></Field>
              <ImageField label="Background image or video" value={config.image_url || ''} onChange={(v) => set('image_url', v)} notify={notify} />
              <Field label="Text alignment">
                <select className="input" value={config.align || 'center'} onChange={(e) => set('align', e.target.value)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={!!config.parallax} onChange={(e) => set('parallax', e.target.checked)} />
                Parallax (background drifts as you scroll)
              </label>
              {isVideo(config.image_url) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={!!config.audio} onChange={(e) => set('audio', e.target.checked)} />
                  Play video audio
                </label>
              )}
            </>
          )}

          {tile.type === 'heading' && (
            <>
              <Field label="Text"><input className="input" value={config.text || ''} onChange={(e) => set('text', e.target.value)} /></Field>
              <Field label="Size">
                <select className="input" value={String(config.level || 2)} onChange={(e) => set('level', Number(e.target.value))}>
                  <option value="1">Large</option>
                  <option value="2">Normal</option>
                </select>
              </Field>
              <Field label="Icon (optional prefix)"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
            </>
          )}

          {tile.type === 'link' && (
            <>
              <Field label="Label"><input className="input" value={config.label || ''} onChange={(e) => set('label', e.target.value)} /></Field>
              <Field label="URL"><input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
              <Field label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
              <Field label="Description"><input className="input" value={config.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
            </>
          )}

          {tile.type === 'service' && (
            <>
              <Field label="Name"><input className="input" value={config.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Type">
                <select className="input" value={config.kind || 'web'} onChange={(e) => set('kind', e.target.value)}>
                  <option value="web">Web service (HTTP)</option>
                  <option value="minecraft">Minecraft server</option>
                </select>
              </Field>
              {config.kind === 'minecraft' ? (
                <>
                  <Field label="Host"><input className="input" value={config.host || ''} onChange={(e) => set('host', e.target.value)} placeholder="mc.zachsbullshit.com" /></Field>
                  <Field label="Port (optional — SRV/25565 default)"><input className="input" value={config.port || ''} onChange={(e) => set('port', e.target.value ? Number(e.target.value) : undefined)} placeholder="25565" /></Field>
                </>
              ) : (
                <Field label="URL to check & open"><input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
              )}
              <Field label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
            </>
          )}

          {tile.type === 'project' && (
            <>
              <Field label="Title"><input className="input" value={config.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
              <Field label="Description"><textarea className="textarea" style={{ minHeight: 70 }} value={config.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label="Tags (comma-separated)"><input className="input" value={Array.isArray(config.tags) ? config.tags.join(', ') : ''} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} /></Field>
              <Field label="Live URL"><input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} /></Field>
              <Field label="Repo URL"><input className="input" value={config.repo_url || ''} onChange={(e) => set('repo_url', e.target.value)} /></Field>
              <Field label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
              <Field label="Image URL"><input className="input" value={config.image_url || ''} onChange={(e) => set('image_url', e.target.value)} /></Field>
            </>
          )}

          {tile.type === 'text' && (
            <>
              <Field label="Text"><textarea className="textarea" value={config.body || ''} onChange={(e) => set('body', e.target.value)} /></Field>
              <Field label="Alignment">
                <select className="input" value={config.align || 'left'} onChange={(e) => set('align', e.target.value)}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </Field>
            </>
          )}

          {tile.type === 'contact' && (
            <>
              <Field label="Heading"><input className="input" value={config.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
              <Field label="Subtitle"><input className="input" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></Field>
            </>
          )}

          {/* Every non-banner tile can carry its own background image or video. */}
          {tile.type !== 'banner' && (
            <>
              <ImageField label="Tile background — image or video (optional)" value={config.bg_image || ''} onChange={(v) => set('bg_image', v)} notify={notify} />
              {isVideo(config.bg_image) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={!!config.bg_audio} onChange={(e) => set('bg_audio', e.target.checked)} />
                  Play video audio
                </label>
              )}
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            <Field label="Width (1–12 cols)">
              <input
                type="number"
                className="input"
                min={1}
                max={12}
                value={w}
                onChange={(e) => setW(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              />
            </Field>
            <Field label="Height (rows)">
              <input
                type="number"
                className="input"
                min={1}
                max={24}
                value={h}
                onChange={(e) => setH(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
              />
            </Field>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 4px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Visible on the site
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn--danger btn--sm" onClick={onDelete} title="Delete tile">
            <Icon name="trash" /> Delete
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={() => onSave(config, enabled, w, h)}>
            <Icon name="floppy-disk" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/** URL input + file upload for an image config field. */
function ImageField({
  label,
  value,
  onChange,
  notify,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  notify: (m: string, e?: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
      notify('Image uploaded');
    } catch {
      notify('Upload failed', true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…  or upload →" />
        <button type="button" className="btn btn--ghost" onClick={() => inputRef.current?.click()} disabled={busy} title="Upload image">
          {busy ? <Icon name="spinner" spin /> : <Icon name="upload" />}
        </button>
      </div>
      {value &&
        (isVideo(value) ? (
          <video src={value} muted loop autoPlay playsInline style={{ marginTop: 8, maxHeight: 90, borderRadius: 8, border: '1px solid var(--border)' }} />
        ) : (
          <img src={value} alt="" style={{ marginTop: 8, maxHeight: 80, borderRadius: 8, border: '1px solid var(--border)' }} />
        ))}
      <input ref={inputRef} type="file" accept="image/*,video/mp4,video/webm" hidden onChange={onFile} />
    </div>
  );
}

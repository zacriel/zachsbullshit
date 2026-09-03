import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { uploadImage } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { IconPicker } from '../components/IconPicker';
import { isVideo } from './media';
import type { Tile } from '../types';

/**
 * Modal editor for a tile's configuration. Uses a wide two-column layout with
 * a pinned header/footer and a scrolling body so it never runs too tall.
 */
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
      <div className="modal modal--editor" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="section__icon"><Icon name="pen-to-square" /></span>
          <h2 style={{ fontSize: '1.2rem', textTransform: 'capitalize' }}>{tile.type} tile</h2>
        </div>

        <div className="modal__body">
          <div className="editor-grid">
            {tile.type === 'banner' && (
              <>
                <Field label="Title"><input className="input" value={config.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
                <Field label="Subtitle"><input className="input" value={config.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></Field>
                <Field label="Text alignment">
                  <select className="input" value={config.align || 'center'} onChange={(e) => set('align', e.target.value)}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
                <ImageField wide label="Background image or video" value={config.image_url || ''} onChange={(v) => set('image_url', v)} notify={notify} />
                <Toggle label="Parallax (background drifts as you scroll)" checked={!!config.parallax} onChange={(v) => set('parallax', v)} />
                {isVideo(config.image_url) && (
                  <Toggle label="Play video audio" checked={!!config.audio} onChange={(v) => set('audio', v)} />
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
                <Field wide label="Icon (optional prefix)"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
              </>
            )}

            {tile.type === 'link' && (
              <>
                <Field label="Label"><input className="input" value={config.label || ''} onChange={(e) => set('label', e.target.value)} /></Field>
                <Field label="URL"><input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
                <Field wide label="Description"><input className="input" value={config.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
                <Field wide label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
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
                    <Field label="Port (SRV/25565 default)"><input className="input" value={config.port || ''} onChange={(e) => set('port', e.target.value ? Number(e.target.value) : undefined)} placeholder="25565" /></Field>
                  </>
                ) : (
                  <Field wide label="URL to check & open"><input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
                )}
                <Field wide label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
              </>
            )}

            {tile.type === 'project' && (
              <>
                <Field label="Title"><input className="input" value={config.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
                <Field label="Tags (comma-separated)"><input className="input" value={Array.isArray(config.tags) ? config.tags.join(', ') : ''} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} /></Field>
                <Field wide label="Description"><textarea className="textarea" style={{ minHeight: 70 }} value={config.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
                <Field label="Live URL"><input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} /></Field>
                <Field label="Repo URL"><input className="input" value={config.repo_url || ''} onChange={(e) => set('repo_url', e.target.value)} /></Field>
                <Field wide label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
                <Field wide label="Image URL"><input className="input" value={config.image_url || ''} onChange={(e) => set('image_url', e.target.value)} /></Field>
              </>
            )}

            {tile.type === 'text' && (
              <>
                <Field wide label="Text"><textarea className="textarea" value={config.body || ''} onChange={(e) => set('body', e.target.value)} /></Field>
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
                <ImageField wide label="Tile background — image or video (optional)" value={config.bg_image || ''} onChange={(v) => set('bg_image', v)} notify={notify} />
                {isVideo(config.bg_image) && (
                  <Toggle label="Play video audio" checked={!!config.bg_audio} onChange={(v) => set('bg_audio', v)} />
                )}
              </>
            )}

            <Field label="Width (1–12 cols)">
              <input type="number" className="input" min={1} max={12} value={w} onChange={(e) => setW(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} />
            </Field>
            <Field label="Height (rows)">
              <input type="number" className="input" min={1} max={24} value={h} onChange={(e) => setH(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} />
            </Field>

            <Toggle label="Visible on the site" checked={enabled} onChange={setEnabled} />
          </div>
        </div>

        <div className="modal__foot">
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

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`field ${wide ? 'span-2' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="editor-toggle span-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** URL input + file upload for an image/video config field. */
function ImageField({
  label,
  value,
  onChange,
  notify,
  wide,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  notify: (m: string, e?: boolean) => void;
  wide?: boolean;
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
      notify('Uploaded');
    } catch {
      notify('Upload failed', true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={`field ${wide ? 'span-2' : ''}`}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…  or upload →" />
        <button type="button" className="btn btn--ghost" onClick={() => inputRef.current?.click()} disabled={busy} title="Upload file">
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

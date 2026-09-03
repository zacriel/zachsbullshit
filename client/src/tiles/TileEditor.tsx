import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { api, uploadImage, uploadFile } from '../api';
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
                <ImageListField
                  label="Slideshow images (2+ overrides the single background)"
                  value={Array.isArray(config.images) ? config.images : []}
                  onChange={(v) => set('images', v)}
                  notify={notify}
                />
                {Array.isArray(config.images) && config.images.length > 1 && (
                  <>
                    <Field label="Animation">
                      <select className="input" value={config.animate || 'fade'} onChange={(e) => set('animate', e.target.value)}>
                        <option value="fade">Cross-fade</option>
                        <option value="kenburns">Cross-fade + slow zoom</option>
                      </select>
                    </Field>
                    <Field label="Seconds per image">
                      <input className="input" type="number" min={2} value={config.interval || 6} onChange={(e) => set('interval', Number(e.target.value) || 6)} />
                    </Field>
                  </>
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

            {tile.type === 'icons' && (
              <>
                <Field label="Alignment">
                  <select className="input" value={config.align || 'center'} onChange={(e) => set('align', e.target.value)}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
                <Field label="Icon size">
                  <select className="input" value={config.size || 'md'} onChange={(e) => set('size', e.target.value)}>
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </Field>
                <div className="span-2">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Icons</label>
                  <IconItems value={Array.isArray(config.items) ? config.items : []} onChange={(v) => set('items', v)} />
                </div>
              </>
            )}

            {tile.type === 'download' && (
              <>
                <Field label="Title"><input className="input" value={config.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
                <Field label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
                <Field wide label="Description"><input className="input" value={config.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
                <FileField
                  wide
                  filename={config.filename}
                  size={config.size}
                  notify={notify}
                  onUpload={(r) => setConfig((cc) => ({ ...cc, file: r.file, filename: r.filename, size: r.size }))}
                />
                <div className="field span-2">
                  <label>Password {config.protected ? '(protected — type to change, or remove)' : '(optional)'}</label>
                  <input className="input" type="password" placeholder={config.protected ? 'Leave blank to keep current' : 'No password'} value={config.password ?? ''} onChange={(e) => set('password', e.target.value)} />
                  {config.protected && (
                    <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={() => set('password', '')}>
                      <Icon name="lock-open" /> Remove password
                    </button>
                  )}
                </div>
              </>
            )}

            {tile.type === 'embed' && (
              <>
                <Field wide label="Embed URL (YouTube, Vimeo, Maps, CodePen, Spotify…)">
                  <input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
                </Field>
                <Field wide label="Title (accessibility)"><input className="input" value={config.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
              </>
            )}

            {tile.type === 'command' && (
              <>
                <Field label="Label"><input className="input" value={config.label || ''} onChange={(e) => set('label', e.target.value)} /></Field>
                <Field label="Icon"><IconPicker value={config.icon || ''} onChange={(v) => set('icon', v)} /></Field>
                <Field wide label="Command / snippet"><textarea className="textarea" style={{ minHeight: 60, fontFamily: 'var(--font-mono, monospace)' }} value={config.command || ''} onChange={(e) => set('command', e.target.value)} /></Field>
              </>
            )}

            {tile.type === 'clock' && (
              <>
                <Field label="Mode">
                  <select className="input" value={config.mode || 'clock'} onChange={(e) => set('mode', e.target.value)}>
                    <option value="clock">Clock</option>
                    <option value="countdown">Countdown</option>
                  </select>
                </Field>
                <Field label="Label (optional)"><input className="input" value={config.label || ''} onChange={(e) => set('label', e.target.value)} /></Field>
                {config.mode === 'countdown' ? (
                  <Field wide label="Target date & time">
                    <input className="input" type="datetime-local" value={config.target || ''} onChange={(e) => set('target', e.target.value)} />
                  </Field>
                ) : (
                  <>
                    <Field label="Timezone (IANA, optional)"><input className="input" value={config.timezone || ''} onChange={(e) => set('timezone', e.target.value)} placeholder="America/New_York" /></Field>
                    <Toggle label="Show seconds" checked={config.showSeconds !== false} onChange={(v) => set('showSeconds', v)} />
                  </>
                )}
              </>
            )}

            {tile.type === 'weather' && (
              <>
                <WeatherLocation config={config} set={set} notify={notify} />
                <Field label="Units">
                  <select className="input" value={config.units || 'c'} onChange={(e) => set('units', e.target.value)}>
                    <option value="c">Celsius</option>
                    <option value="f">Fahrenheit</option>
                  </select>
                </Field>
                <Field label="Label (optional)"><input className="input" value={config.label || ''} onChange={(e) => set('label', e.target.value)} placeholder="defaults to place name" /></Field>
              </>
            )}

            {tile.type === 'rss' && (
              <>
                <Field wide label="Feed URL (RSS or Atom)"><input className="input" value={config.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…/feed.xml" /></Field>
                <Field label="Label"><input className="input" value={config.label || ''} onChange={(e) => set('label', e.target.value)} /></Field>
                <Field label="Items to show"><input className="input" type="number" min={1} max={20} value={config.count || 6} onChange={(e) => set('count', Math.max(1, Math.min(20, Number(e.target.value) || 6)))} /></Field>
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

/** A list of image URLs (with per-row upload) for banner slideshows. */
function ImageListField({
  label,
  value,
  onChange,
  notify,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  notify: (m: string, e?: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const setAt = (i: number, url: string) => onChange(value.map((v, j) => (j === i ? url : v)));
  const removeAt = (i: number) => onChange(value.filter((_, j) => j !== i));

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onChange([...value, url]);
      notify('Uploaded');
    } catch {
      notify('Upload failed', true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="field span-2">
      <label>{label}</label>
      {value.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input className="input" value={v} placeholder="https://…" onChange={(e) => setAt(i, e.target.value)} />
          <button className="btn btn--danger btn--icon" onClick={() => removeAt(i)} title="Remove"><Icon name="trash" /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange([...value, ''])}><Icon name="plus" /> Add URL</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Icon name="spinner" spin /> : <Icon name="upload" />} Upload
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

/** Upload any file for a download tile. */
function FileField({
  filename,
  size,
  onUpload,
  notify,
  wide,
}: {
  filename?: string;
  size?: number;
  onUpload: (r: { file: string; filename: string; size: number }) => void;
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
      const r = await uploadFile(file);
      onUpload(r);
      notify('File uploaded');
    } catch {
      notify('Upload failed', true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={`field ${wide ? 'span-2' : ''}`}>
      <label>File</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Icon name="spinner" spin /> : <Icon name="upload" />} {filename ? 'Replace file' : 'Upload file'}
        </button>
        {filename && (
          <span className="admin-row__muted" style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>
            {filename}
            {size ? ` · ${Math.round((size / 1024 / 1024) * 10) / 10} MB` : ''}
          </span>
        )}
      </div>
      <input ref={inputRef} type="file" hidden onChange={onFile} />
    </div>
  );
}

/** Compact editor for the icon-row tile's list of links. */
function IconItems({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const setAt = (i: number, patch: Record<string, unknown>) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const removeAt = (i: number) => onChange(value.filter((_, j) => j !== i));
  return (
    <div>
      {value.map((it, i) => (
        <div key={i} className="icon-item-row">
          <span className="icon-item-row__preview"><Icon name={it.icon || 'link'} /></span>
          <input className="input" style={{ maxWidth: 120 }} value={it.icon || ''} placeholder="fa icon" onChange={(e) => setAt(i, { icon: e.target.value })} />
          <input className="input" value={it.url || ''} placeholder="https://…" onChange={(e) => setAt(i, { url: e.target.value })} />
          <input className="input" style={{ maxWidth: 130 }} value={it.label || ''} placeholder="label" onChange={(e) => setAt(i, { label: e.target.value })} />
          <button className="btn btn--danger btn--icon" onClick={() => removeAt(i)} title="Remove"><Icon name="trash" /></button>
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => onChange([...value, { icon: 'link', url: '', label: '' }])}>
        <Icon name="plus" /> Add icon
      </button>
    </div>
  );
}

/** Place-name → coordinates via the geocode endpoint, for weather tiles. */
function WeatherLocation({
  config,
  set,
  notify,
}: {
  config: Record<string, any>;
  set: (k: string, v: unknown) => void;
  notify: (m: string, e?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function find() {
    const q = String(config.place || '').trim();
    if (!q) {
      notify('Enter a place', true);
      return;
    }
    setBusy(true);
    try {
      const r = await api.get<{ results: { latitude: number; longitude: number; name: string; admin1?: string; country_code?: string }[] }>(
        `/tiles/geocode?q=${encodeURIComponent(q)}`,
      );
      const hit = r.results?.[0];
      if (!hit) {
        notify('No match found', true);
        return;
      }
      set('lat', hit.latitude);
      set('lon', hit.longitude);
      set('place', [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(', '));
      notify('Location set');
    } catch {
      notify('Lookup failed', true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="field span-2">
      <label>Location</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={config.place || ''} placeholder="City, e.g. Denver" onChange={(e) => set('place', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && find()} />
        <button type="button" className="btn btn--ghost" onClick={find} disabled={busy}>
          {busy ? <Icon name="spinner" spin /> : <Icon name="magnifying-glass" />} Find
        </button>
      </div>
      {config.lat != null && (
        <span className="admin-row__muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
          Set to {Number(config.lat).toFixed(2)}, {Number(config.lon).toFixed(2)}
        </span>
      )}
    </div>
  );
}

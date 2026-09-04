import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, trackClick } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { TileMedia } from './media';
import { usePages } from './PagesContext';
import type { ServiceStatus, Tile } from '../types';

/** Renders a single tile in view (non-editing) mode by its type. */
export function TileView({ tile, status }: { tile: Tile; status?: ServiceStatus }) {
  switch (tile.type) {
    case 'banner':
      return <BannerTile tile={tile} />;
    case 'heading':
      return <HeadingTile tile={tile} />;
    case 'link':
      return <LinkTile tile={tile} />;
    case 'service':
      return <ServiceTile tile={tile} status={status} />;
    case 'project':
      return <ProjectTile tile={tile} />;
    case 'text':
      return <TextTile tile={tile} />;
    case 'contact':
      return <ContactTile tile={tile} />;
    case 'icons':
      return <IconsTile tile={tile} />;
    case 'download':
      return <DownloadTile tile={tile} />;
    case 'embed':
      return <EmbedTile tile={tile} />;
    case 'command':
      return <CommandTile tile={tile} />;
    case 'clock':
      return <ClockTile tile={tile} />;
    case 'weather':
      return <WeatherTile tile={tile} />;
    case 'rss':
      return <RssTile tile={tile} />;
    case 'tabs':
      return <TabsTile tile={tile} />;
    default:
      return null;
  }
}

/** Build a favicon URL for a link's destination host (Google's S2 service). */
function faviconUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`;
  } catch {
    return null;
  }
}

/**
 * Page navigation, rendered as an ordinary (global) tile so it can be placed
 * anywhere on the grid. Visitors click tabs to switch pages; admins can add,
 * rename, reorder, and delete pages right here in edit mode.
 */
function TabsTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const { authed, editMode } = useAuth();
  const { pages, activePageId, setActivePage, addPage, renamePage, deletePage, reorderPages } = usePages();
  const editing = !!authed && editMode;
  const justify = c.align === 'left' ? 'flex-start' : c.align === 'right' ? 'flex-end' : 'center';
  const variant = c.variant === 'underline' ? 'underline' : 'pills';
  const activeIdx = pages.findIndex((p) => p.id === activePageId);
  const active = activeIdx >= 0 ? pages[activeIdx] : null;

  async function onAdd() {
    const name = window.prompt('New page name', 'New page');
    if (name && name.trim()) await addPage(name.trim());
  }
  async function onRename() {
    if (!active) return;
    const name = window.prompt('Rename page', active.name);
    if (name && name.trim() && name.trim() !== active.name) await renamePage(active.id, name.trim());
  }
  async function onDelete() {
    if (!active || pages.length <= 1) return;
    if (window.confirm(`Delete “${active.name}” and every tile on it? This can't be undone.`)) {
      await deletePage(active.id);
    }
  }
  function move(dir: -1 | 1) {
    if (activeIdx < 0) return;
    const j = activeIdx + dir;
    if (j < 0 || j >= pages.length) return;
    const ids = pages.map((p) => p.id);
    [ids[activeIdx], ids[j]] = [ids[j], ids[activeIdx]];
    void reorderPages(ids);
  }

  return (
    <div className={`tile tile--tabs tile--tabs--${variant}`}>
      {editing && (
        <span className="tabs__grip" title="Drag to move this tile">
          <Icon name="up-down-left-right" /> Drag to move
        </span>
      )}
      <div className="tabs__row" style={{ justifyContent: justify }}>
        {pages.map((p) => (
          <button
            key={p.id}
            className={`tabnav ${p.id === activePageId ? 'tabnav--on' : ''}`}
            onClick={() => setActivePage(p.id)}
          >
            {p.name}
          </button>
        ))}
        {editing && (
          <button className="tabnav tabnav--add" onClick={onAdd} title="Add page">
            <Icon name="plus" />
          </button>
        )}
        {pages.length === 0 && !editing && <span className="admin-row__muted">No pages</span>}
      </div>

      {editing && active && (
        <div className="tabs__admin">
          <span className="admin-row__muted" style={{ marginRight: 4 }}>Page “{active.name}”:</span>
          <button className="btn btn--ghost btn--sm" onClick={() => move(-1)} disabled={activeIdx === 0} title="Move left">
            <Icon name="arrow-left" />
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => move(1)} disabled={activeIdx === pages.length - 1} title="Move right">
            <Icon name="arrow-right" />
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onRename}>
            <Icon name="pen" /> Rename
          </button>
          <button className="btn btn--danger btn--sm" onClick={onDelete} disabled={pages.length <= 1}>
            <Icon name="trash" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function BannerTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const align = c.align === 'left' ? 'flex-start' : c.align === 'right' ? 'flex-end' : 'center';
  return (
    <div
      className="tile tile--banner"
      style={{
        alignItems: align,
        textAlign: c.align === 'left' ? 'left' : c.align === 'right' ? 'right' : 'center',
      }}
    >
      {Array.isArray(c.images) && c.images.filter(Boolean).length > 0 ? (
        <BannerSlides images={c.images.filter(Boolean)} interval={Number(c.interval) || 6} kenburns={c.animate === 'kenburns'} />
      ) : (
        c.image_url && <TileMedia src={c.image_url} parallax={!!c.parallax} audio={!!c.audio} />
      )}
      <div className="tile--banner__scrim" />
      <div className="tile--banner__content">
        <h1 className="tile--banner__title">{c.title || ''}</h1>
        {c.subtitle && <p className="tile--banner__subtitle">{c.subtitle}</p>}
      </div>
    </div>
  );
}

function HeadingTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  return (
    <div className="tile tile--heading">
      <h2 style={{ fontSize: c.level === 1 ? '2rem' : '1.5rem' }}>
        {c.icon && <Icon name={c.icon} className="tile--heading__icon" />}
        {c.text || ''}
      </h2>
      <span className="tile--heading__rule" />
    </div>
  );
}

function LinkTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const url: string = c.url || '#';
  const [icoFailed, setIcoFailed] = useState(false);
  // When "use site favicon" is on, show the destination's favicon; fall back to
  // the chosen FontAwesome icon if it can't load.
  const favi = c.favicon ? faviconUrl(url) : null;
  return (
    <a
      className="tile tile--link"
      href={url}
      target={url.startsWith('mailto:') ? undefined : '_blank'}
      rel="noopener noreferrer"
      onClick={() => trackClick(tile.id)}
    >
      <span className="link-card__icon">
        {favi && !icoFailed ? (
          <img className="link-card__favicon" src={favi} alt="" loading="lazy" onError={() => setIcoFailed(true)} />
        ) : (
          <Icon name={c.icon || 'link'} />
        )}
      </span>
      <span className="link-card__body">
        <span className="link-card__label">{c.label || 'Link'}</span>
        {c.description && <span className="link-card__desc">{c.description}</span>}
      </span>
      <Icon name="arrow-up-right-from-square" className="link-card__arrow" />
    </a>
  );
}

function ProjectTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const tags: string[] = Array.isArray(c.tags) ? c.tags : [];
  return (
    <article className="tile tile--project">
      {c.image_url && <img className="project-card__img" src={c.image_url} alt={c.title} loading="lazy" />}
      <div className="project-card__body">
        <h3 className="project-card__title">
          <Icon name={c.icon || 'cube'} fixedWidth />
          {c.title || 'Project'}
        </h3>
        {c.description && <p className="project-card__desc">{c.description}</p>}
        {tags.length > 0 && (
          <div className="tags">
            {tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
        {(c.url || c.repo_url) && (
          <div className="project-card__links">
            {c.url && (
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                <Icon name="up-right-from-square" /> Live
              </a>
            )}
            {c.repo_url && (
              <a href={c.repo_url} target="_blank" rel="noopener noreferrer">
                <Icon name="code-branch" /> Source
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function TextTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  return (
    <div className="tile tile--text" style={{ textAlign: c.align || 'left' }}>
      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{c.body || ''}</p>
    </div>
  );
}

function ServiceTile({ tile, status }: { tile: Tile; status?: ServiceStatus }) {
  const { notify } = useAuth();
  const c = tile.config;
  const isMc = c.kind === 'minecraft';
  const address: string = c.host || c.url || '';
  const state = status?.status || (status ? 'down' : null);

  const copy = () => {
    navigator.clipboard.writeText(address).then(
      () => notify('Address copied'),
      () => notify('Copy failed', true),
    );
  };

  return (
    <div className="tile tile--service">
      <div className="tile--service__head">
        <span className="link-card__icon" style={{ width: 40, height: 40, fontSize: '1rem' }}>
          <Icon name={c.icon || (isMc ? 'cube' : 'server')} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tile--service__name">{c.name || 'Service'}</div>
          <div className="admin-row__muted" style={{ wordBreak: 'break-word' }}>
            {address}
          </div>
        </div>
        <StatusPill state={state} />
      </div>

      {isMc && status?.status === 'up' && (
        <div className="tile--service__meta">
          <span><Icon name="users" /> {status.players_online ?? 0}/{status.players_max ?? 0}</span>
          {status.version && <span className="admin-row__muted">{status.version}</span>}
        </div>
      )}
      {isMc && status?.motd && status.status === 'up' && (
        <p className="tile--service__motd">{status.motd}</p>
      )}
      {!isMc && status?.latency_ms != null && status.status !== 'down' && (
        <div className="tile--service__meta admin-row__muted">
          <span><Icon name="gauge" /> {status.latency_ms} ms</span>
          {status.code && <span>HTTP {status.code}</span>}
        </div>
      )}

      <div className="tile--service__actions">
        {isMc ? (
          <button className="btn btn--primary btn--sm" onClick={copy}>
            <Icon name="copy" /> Copy address
          </button>
        ) : (
          <a className="btn btn--primary btn--sm" href={c.url || '#'} target="_blank" rel="noopener noreferrer">
            <Icon name="up-right-from-square" /> Open
          </a>
        )}
      </div>
    </div>
  );
}

function ContactTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' });
  const upd = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setErr('');
    try {
      await api.post('/contact', form);
      setState('sent');
      setForm({ name: '', email: '', message: '', website: '' });
    } catch (e2) {
      setState('error');
      setErr(e2 instanceof ApiError ? e2.message : 'Something went wrong.');
    }
  }

  return (
    <div className="tile tile--contact">
      <div className="tile--contact__head">
        <h3>{c.title || 'Get in touch'}</h3>
        {c.subtitle && <p className="admin-row__muted">{c.subtitle}</p>}
      </div>
      {state === 'sent' ? (
        <div className="tile--contact__done">
          <Icon name="circle-check" /> Thanks — your message is on its way.
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setState('idle')}>
            Send another
          </button>
        </div>
      ) : (
        <form className="tile--contact__form" onSubmit={submit}>
          <input className="input" placeholder="Name" value={form.name} onChange={upd('name')} required maxLength={120} />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={upd('email')} required maxLength={200} />
          <textarea className="textarea" placeholder="Message" value={form.message} onChange={upd('message')} required maxLength={4000} />
          <input className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={upd('website')} />
          {state === 'error' && <p style={{ color: 'var(--down)', margin: 0, fontSize: '0.85rem' }}>{err}</p>}
          <button className="btn btn--primary" type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? <Icon name="spinner" spin /> : <Icon name="paper-plane" />} Send
          </button>
        </form>
      )}
    </div>
  );
}

function BannerSlides({ images, interval, kenburns }: { images: string[]; interval: number; kenburns: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % images.length), Math.max(2, interval) * 1000);
    return () => window.clearInterval(t);
  }, [images.length, interval]);
  return (
    <div className="tile-media">
      {images.map((src, idx) => (
        <div
          key={src + idx}
          className={`banner-slide ${idx === i ? 'banner-slide--on' : ''} ${kenburns ? 'banner-slide--kb' : ''}`}
          style={{ backgroundImage: `url("${src}")` }}
        />
      ))}
    </div>
  );
}

function IconsTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const items: { icon: string; url: string; label?: string }[] = Array.isArray(c.items) ? c.items : [];
  const justify = c.align === 'left' ? 'flex-start' : c.align === 'right' ? 'flex-end' : 'center';
  return (
    <div className="tile tile--icons" style={{ justifyContent: justify }}>
      {items.map((it, idx) => (
        <a
          key={idx}
          className={`icon-btn icon-btn--${c.size || 'md'}`}
          href={it.url || '#'}
          target={it.url?.startsWith('mailto:') ? undefined : '_blank'}
          rel="noopener noreferrer"
          title={it.label || ''}
          aria-label={it.label || it.icon}
          onClick={() => trackClick(tile.id)}
        >
          <Icon name={it.icon || 'link'} />
        </a>
      ))}
    </div>
  );
}

function humanSize(bytes: number): string {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function DownloadTile({ tile }: { tile: Tile }) {
  const { notify } = useAuth();
  const c = tile.config;
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // An external URL points at a file hosted elsewhere (no size cap, but no
  // password gate). It takes precedence over an uploaded file.
  const external = typeof c.external_url === 'string' && c.external_url ? c.external_url : '';
  const protectedFile = !external && !!c.protected;

  async function download() {
    setBusy(true);
    setErr('');
    try {
      const resp = await fetch(`/api/tiles/${tile.id}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (resp.status === 401) {
        setErr('Incorrect password');
        return;
      }
      if (!resp.ok) {
        setErr('Download unavailable');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = c.filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr('Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tile tile--download">
      <div className="tile--download__head">
        <span className="link-card__icon" style={{ width: 44, height: 44 }}>
          <Icon name={c.icon || 'download'} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tile--download__title">
            {c.title || 'Download'} {protectedFile && <Icon name="lock" className="tile--download__lock" />}
          </div>
          {(c.filename || c.size) && (
            <div className="admin-row__muted" style={{ fontSize: '0.8rem', wordBreak: 'break-word' }}>
              {c.filename} {c.size ? `· ${humanSize(Number(c.size))}` : ''}
            </div>
          )}
        </div>
      </div>
      {c.description && <p className="tile--download__desc">{c.description}</p>}
      {protectedFile && (
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && download()}
        />
      )}
      {err && <p style={{ color: 'var(--down)', margin: 0, fontSize: '0.82rem' }}>{err}</p>}
      {external ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <a
            className="btn btn--primary"
            style={{ flex: 1 }}
            href={external}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick(tile.id)}
          >
            <Icon name="download" /> Download
          </a>
          <button
            className="btn btn--ghost btn--icon"
            title="Copy link"
            onClick={() =>
              navigator.clipboard.writeText(external).then(
                () => notify('Link copied'),
                () => notify('Copy failed', true),
              )
            }
          >
            <Icon name="link" />
          </button>
        </div>
      ) : (
        <button className="btn btn--primary" style={{ marginTop: 'auto' }} onClick={download} disabled={busy || !c.file}>
          {busy ? <Icon name="spinner" spin /> : <Icon name="download" />} {c.file ? 'Download' : 'No file'}
        </button>
      )}
    </div>
  );
}

/** Only allow embeds from known-safe hosts; transform common watch URLs. */
function embedSrc(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const yt = host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com';
  if (yt) {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.split('/').pop();
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  const allowed = [
    'player.vimeo.com', 'vimeo.com', 'openstreetmap.org', 'google.com', 'maps.google.com',
    'codepen.io', 'codesandbox.io', 'open.spotify.com', 'bandcamp.com', 'soundcloud.com',
  ];
  if (allowed.some((a) => host === a || host.endsWith(`.${a}`))) return url.toString();
  return null;
}

function EmbedTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const src = embedSrc(c.url || '');
  return (
    <div className="tile tile--embed">
      {src ? (
        <iframe
          className="tile--embed__frame"
          src={src}
          title={c.title || 'embed'}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="empty" style={{ margin: 0 }}>
          {c.url ? 'This host isn’t allowed for embeds.' : 'No embed URL set.'}
        </div>
      )}
    </div>
  );
}

function CommandTile({ tile }: { tile: Tile }) {
  const { notify } = useAuth();
  const c = tile.config;
  const copy = () => {
    navigator.clipboard.writeText(c.command || '').then(
      () => notify('Copied'),
      () => notify('Copy failed', true),
    );
  };
  return (
    <div className="tile tile--command">
      {c.label && (
        <div className="tile--command__label">
          <Icon name={c.icon || 'terminal'} /> {c.label}
        </div>
      )}
      <div className="tile--command__row">
        <code className="tile--command__code">{c.command || ''}</code>
        <button className="btn btn--ghost btn--icon" onClick={copy} title="Copy">
          <Icon name="copy" />
        </button>
      </div>
    </div>
  );
}

function ClockTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (c.mode === 'countdown' && c.target) {
    const diff = new Date(c.target).getTime() - now;
    const done = diff <= 0;
    const s = Math.max(0, Math.floor(diff / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return (
      <div className="tile tile--clock">
        {c.label && <div className="tile--clock__label">{c.label}</div>}
        <div className="tile--clock__time">
          {done ? "It's time" : `${d}d ${h}h ${m}m ${sec}s`}
        </div>
      </div>
    );
  }

  const opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...(c.showSeconds !== false ? { second: '2-digit' } : {}),
    ...(c.timezone ? { timeZone: c.timezone } : {}),
  };
  let time = '';
  try {
    time = new Date(now).toLocaleTimeString([], opts);
  } catch {
    time = new Date(now).toLocaleTimeString();
  }
  return (
    <div className="tile tile--clock">
      {c.label && <div className="tile--clock__label">{c.label}</div>}
      <div className="tile--clock__time">{time}</div>
      {c.timezone && <div className="tile--clock__zone">{c.timezone}</div>}
    </div>
  );
}

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: 'sun' },
  1: { label: 'Mainly clear', icon: 'cloud-sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'smog' },
  48: { label: 'Fog', icon: 'smog' },
  51: { label: 'Drizzle', icon: 'cloud-rain' },
  61: { label: 'Rain', icon: 'cloud-showers-heavy' },
  63: { label: 'Rain', icon: 'cloud-showers-heavy' },
  71: { label: 'Snow', icon: 'snowflake' },
  80: { label: 'Showers', icon: 'cloud-showers-heavy' },
  95: { label: 'Thunderstorm', icon: 'cloud-bolt' },
};

function WeatherTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const [data, setData] = useState<{ temperature_2m: number; weather_code: number; wind_speed_10m: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const f = c.units === 'f';

  useEffect(() => {
    if (c.lat == null || c.lon == null) return;
    api
      .get<{ weather: { temperature_2m: number; weather_code: number; wind_speed_10m: number } | null }>(
        `/tiles/weather?lat=${c.lat}&lon=${c.lon}`,
      )
      .then((r) => setData(r.weather))
      .catch(() => setFailed(true));
  }, [c.lat, c.lon]);

  const code = data ? WEATHER_CODES[data.weather_code] || { label: '', icon: 'cloud' } : null;
  const temp = data ? (f ? data.temperature_2m * 1.8 + 32 : data.temperature_2m) : null;

  return (
    <div className="tile tile--weather">
      <div className="tile--weather__place">
        <Icon name={code?.icon || 'cloud-sun'} /> {c.label || c.place || 'Weather'}
      </div>
      {c.lat == null ? (
        <div className="admin-row__muted">Set a location in the editor.</div>
      ) : failed ? (
        <div className="admin-row__muted">Unavailable</div>
      ) : temp == null ? (
        <div className="admin-row__muted">…</div>
      ) : (
        <>
          <div className="tile--weather__temp">{Math.round(temp)}°{f ? 'F' : 'C'}</div>
          <div className="admin-row__muted">
            {code?.label}
            {data ? ` · ${Math.round(data.wind_speed_10m)} km/h wind` : ''}
          </div>
        </>
      )}
    </div>
  );
}

function RssTile({ tile }: { tile: Tile }) {
  const c = tile.config;
  const [items, setItems] = useState<{ title: string; link: string; date: string | null }[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<{ items: { title: string; link: string; date: string | null }[] }>(`/tiles/${tile.id}/feed`)
      .then((r) => setItems(r.items))
      .catch(() => setFailed(true));
  }, [tile.id]);

  return (
    <div className="tile tile--rss">
      <div className="tile--rss__head">
        <Icon name="rss" /> {c.label || 'Feed'}
      </div>
      {failed ? (
        <div className="admin-row__muted">Couldn't load feed.</div>
      ) : !items ? (
        <div className="admin-row__muted">…</div>
      ) : items.length === 0 ? (
        <div className="admin-row__muted">No items.</div>
      ) : (
        <ul className="tile--rss__list">
          {items.map((it, idx) => (
            <li key={idx}>
              <a href={it.link} target="_blank" rel="noopener noreferrer">
                {it.title || '(untitled)'}
              </a>
              {it.date && <span className="tile--rss__date">{new Date(it.date).toLocaleDateString()}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ state }: { state: string | null }) {
  if (!state) return <span className="pill pill--degraded"><span className="pill__dot" /> …</span>;
  const map: Record<string, { cls: string; label: string }> = {
    up: { cls: 'pill--up', label: 'Online' },
    degraded: { cls: 'pill--degraded', label: 'Degraded' },
    down: { cls: 'pill--down', label: 'Offline' },
  };
  const m = map[state] || map.down;
  return (
    <span className={`pill ${m.cls}`}>
      <span className="pill__dot" /> {m.label}
    </span>
  );
}

import { useState, type FormEvent } from 'react';
import { api, ApiError, trackClick } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { TileMedia } from './media';
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
    default:
      return null;
  }
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
      {c.image_url && <TileMedia src={c.image_url} parallax={!!c.parallax} audio={!!c.audio} />}
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
  return (
    <a
      className="tile tile--link"
      href={url}
      target={url.startsWith('mailto:') ? undefined : '_blank'}
      rel="noopener noreferrer"
      onClick={() => trackClick(tile.id)}
    >
      <span className="link-card__icon">
        <Icon name={c.icon || 'link'} />
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

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import type { ShortLink } from '../types';

/**
 * Admin page for "go links" — a tiny URL shortener. Each link maps a short slug
 * to a destination; visitors hit <site>/go/<slug> and get redirected, with a
 * running click count shown here.
 */
export function GoLinksAdmin({ notify }: { notify: (m: string, e?: boolean) => void }) {
  const [links, setLinks] = useState<ShortLink[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [slug, setSlug] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editSlug, setEditSlug] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const load = useCallback(() => {
    api
      .get<{ links: ShortLink[] }>('/shortlinks')
      .then((r) => {
        setLinks(r.links);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!slug.trim() || !url.trim()) return;
    setBusy(true);
    try {
      const { link } = await api.post<{ link: ShortLink }>('/shortlinks', { slug: slug.trim(), url: url.trim() });
      setLinks((prev) => (prev ? [...prev, link].sort((a, b) => a.slug.localeCompare(b.slug)) : [link]));
      setSlug('');
      setUrl('');
      notify('Link created');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not create link', true);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(l: ShortLink) {
    setEditId(l.id);
    setEditSlug(l.slug);
    setEditUrl(l.url);
  }

  async function saveEdit() {
    if (editId == null) return;
    try {
      const { link } = await api.put<{ link: ShortLink }>(`/shortlinks/${editId}`, { slug: editSlug.trim(), url: editUrl.trim() });
      setLinks((prev) => (prev ? prev.map((x) => (x.id === link.id ? link : x)).sort((a, b) => a.slug.localeCompare(b.slug)) : prev));
      setEditId(null);
      notify('Saved');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Save failed', true);
    }
  }

  async function remove(l: ShortLink) {
    if (!confirm(`Delete /go/${l.slug}?`)) return;
    try {
      await api.del(`/shortlinks/${l.id}`);
      setLinks((prev) => (prev ? prev.filter((x) => x.id !== l.id) : prev));
      notify('Deleted');
    } catch {
      notify('Delete failed', true);
    }
  }

  function copy(l: ShortLink) {
    navigator.clipboard.writeText(`${origin}/go/${l.slug}`).then(
      () => notify('Link copied'),
      () => notify('Copy failed', true),
    );
  }

  return (
    <div className="admin-card">
      <div className="golinks__intro">
        <h2 style={{ fontSize: '1.15rem', marginBottom: 4 }}>
          <Icon name="link" /> Go links
        </h2>
        <p className="admin-row__muted" style={{ margin: 0 }}>
          Short, memorable redirects. <code>{origin}/go/&lt;slug&gt;</code> sends visitors to any destination.
        </p>
      </div>

      <div className="golinks__new">
        <div className="golinks__new-slug">
          <span className="golinks__prefix">/go/</span>
          <input
            className="input"
            placeholder="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/\s+/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </div>
        <input
          className="input"
          placeholder="https://destination.example.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn btn--primary" onClick={create} disabled={busy || !slug.trim() || !url.trim()}>
          {busy ? <Icon name="spinner" spin /> : <Icon name="plus" />} Add
        </button>
      </div>

      {failed ? (
        <div className="empty">Couldn't load go links.</div>
      ) : !links ? (
        <div className="center-state"><span className="spinner" /></div>
      ) : links.length === 0 ? (
        <div className="empty">No go links yet. Create one above.</div>
      ) : (
        <div className="golinks__list">
          {links.map((l) =>
            editId === l.id ? (
              <div key={l.id} className="golinks__row golinks__row--edit">
                <div className="golinks__new-slug">
                  <span className="golinks__prefix">/go/</span>
                  <input className="input" value={editSlug} onChange={(e) => setEditSlug(e.target.value.replace(/\s+/g, ''))} />
                </div>
                <input className="input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                <div className="golinks__actions">
                  <button className="btn btn--primary btn--sm" onClick={saveEdit}><Icon name="check" /> Save</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={l.id} className="golinks__row">
                <div className="golinks__main">
                  <a className="golinks__slug" href={`/go/${l.slug}`} target="_blank" rel="noopener noreferrer">
                    /go/{l.slug}
                  </a>
                  <span className="golinks__dest admin-row__muted">{l.url}</span>
                </div>
                <span className="golinks__clicks" title="Clicks">
                  <Icon name="arrow-pointer" /> {l.clicks}
                </span>
                <div className="golinks__actions">
                  <button className="btn btn--ghost btn--icon btn--sm" onClick={() => copy(l)} title="Copy link"><Icon name="copy" /></button>
                  <button className="btn btn--ghost btn--icon btn--sm" onClick={() => startEdit(l)} title="Edit"><Icon name="pen" /></button>
                  <button className="btn btn--danger btn--icon btn--sm" onClick={() => remove(l)} title="Delete"><Icon name="trash" /></button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

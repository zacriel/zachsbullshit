import { useCallback, useEffect, useState } from 'react';
import { api, trackClick } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Section } from '../components/Section';
import type { LinkItem } from '../types';

/**
 * Links hub. Public visitors get a grid of enabled links with click
 * tracking. In admin edit mode, every card is editable in place, disabled
 * links become visible (dimmed), and a card can be added, toggled, or removed.
 */
export function LinksModule({ icon }: { icon: string }) {
  const { authed, editMode, notify } = useAuth();
  const canEdit = authed && editMode;
  const [links, setLinks] = useState<LinkItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    // In edit mode fetch all (incl. disabled); otherwise only enabled.
    const path = canEdit ? '/links/all' : '/links';
    api
      .get<{ links: LinkItem[] }>(path)
      .then((r) => setLinks(r.links))
      .catch(() => setError(true));
  }, [canEdit]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return null;
  if (!links) return null;
  if (!canEdit && links.length === 0) return null; // nothing public to show

  const patchLocal = (id: number, patch: Partial<LinkItem>) =>
    setLinks((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) : prev));

  async function saveLink(link: LinkItem) {
    try {
      await api.put(`/links/${link.id}`, {
        label: link.label,
        url: link.url,
        icon: link.icon || 'link',
        description: link.description || null,
      });
      notify('Saved');
    } catch {
      notify('Save failed', true);
    }
  }

  async function toggle(link: LinkItem) {
    patchLocal(link.id, { enabled: !link.enabled });
    await api.put(`/links/${link.id}`, { enabled: !link.enabled }).catch(() => notify('Update failed', true));
  }

  async function remove(id: number) {
    if (!confirm('Delete this link?')) return;
    setLinks((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
    await api.del(`/links/${id}`).catch(() => notify('Delete failed', true));
  }

  async function add() {
    try {
      const { link } = await api.post<{ link: LinkItem }>('/links', {
        label: 'New link',
        url: 'https://example.com',
        icon: 'link',
      });
      setLinks((prev) => (prev ? [...prev, link] : [link]));
    } catch {
      notify('Could not add link', true);
    }
  }

  return (
    <Section id="links" title="Links" icon={icon}>
      <div className="grid">
        {links.map((link) =>
          canEdit ? (
            <div key={link.id} className={`link-card ${!link.enabled ? 'disabled-item' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="link-card__icon">
                  <Icon name={link.icon} />
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input className="edit-input" value={link.label} placeholder="Label" onChange={(e) => patchLocal(link.id, { label: e.target.value })} onBlur={() => saveLink(link)} />
                  <input className="edit-input" value={link.url} placeholder="https://…" onChange={(e) => patchLocal(link.id, { url: e.target.value })} onBlur={() => saveLink(link)} />
                </div>
              </div>
              <div className="edit-row" style={{ marginTop: 8 }}>
                <input className="edit-input" style={{ maxWidth: 120 }} value={link.icon} placeholder="fa icon" onChange={(e) => patchLocal(link.id, { icon: e.target.value })} onBlur={() => saveLink(link)} />
                <input className="edit-input" value={link.description || ''} placeholder="Short description" onChange={(e) => patchLocal(link.id, { description: e.target.value })} onBlur={() => saveLink(link)} />
              </div>
              <div className="edit-card-tools">
                <button className="btn btn--ghost btn--sm" onClick={() => toggle(link)}>
                  <Icon name={link.enabled ? 'eye' : 'eye-slash'} /> {link.enabled ? 'Visible' : 'Hidden'}
                </button>
                <span className="spacer" />
                <button className="btn btn--danger btn--sm" onClick={() => remove(link.id)}>
                  <Icon name="trash" /> Delete
                </button>
              </div>
            </div>
          ) : (
            <a
              key={link.id}
              className="link-card"
              href={link.url}
              target={link.url.startsWith('mailto:') ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={() => trackClick(link.id)}
            >
              <span className="link-card__icon">
                <Icon name={link.icon} />
              </span>
              <span className="link-card__body">
                <span className="link-card__label">{link.label}</span>
                {link.description && <span className="link-card__desc">{link.description}</span>}
              </span>
              <Icon name="arrow-up-right-from-square" className="link-card__arrow" />
            </a>
          ),
        )}

        {canEdit && (
          <button className="add-card" onClick={add}>
            <Icon name="plus" /> Add link
          </button>
        )}
      </div>
    </Section>
  );
}

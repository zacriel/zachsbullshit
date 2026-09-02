import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import type { LinkItem } from '../types';

type Draft = {
  id?: number;
  label: string;
  url: string;
  icon: string;
  description: string;
  category: string;
  sort_order: number;
  enabled: boolean;
};

const EMPTY: Draft = {
  label: '',
  url: '',
  icon: 'link',
  description: '',
  category: '',
  sort_order: 0,
  enabled: true,
};

export function LinksAdmin({ notify }: { notify: (m: string, err?: boolean) => void }) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const load = () =>
    api.get<{ links: LinkItem[] }>('/links/all').then((r) => setLinks(r.links)).catch(() => {});

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!draft.label || !draft.url) {
      notify('Label and URL are required', true);
      return;
    }
    const body = {
      label: draft.label,
      url: draft.url,
      icon: draft.icon || 'link',
      description: draft.description || null,
      category: draft.category || null,
      sort_order: Number(draft.sort_order) || 0,
      enabled: draft.enabled,
    };
    try {
      if (draft.id) await api.put(`/links/${draft.id}`, body);
      else await api.post('/links', body);
      setDraft(EMPTY);
      await load();
      notify('Saved');
    } catch {
      notify('Save failed', true);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this link?')) return;
    await api.del(`/links/${id}`).catch(() => notify('Delete failed', true));
    await load();
  }

  async function toggle(link: LinkItem) {
    await api.put(`/links/${link.id}`, { enabled: !link.enabled }).catch(() => {});
    await load();
  }

  return (
    <div>
      <div className="admin-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
          <label>Label</label>
          <input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '2 1 220px' }}>
          <label>URL</label>
          <input className="input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 120px' }}>
          <label>Icon (FA name)</label>
          <input className="input" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 120px' }}>
          <label>Category</label>
          <input className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '2 1 220px' }}>
          <label>Description</label>
          <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, width: 80 }}>
          <label>Order</label>
          <input className="input" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
        </div>
        <button className="btn btn--primary" onClick={save}>
          <Icon name={draft.id ? 'floppy-disk' : 'plus'} /> {draft.id ? 'Update' : 'Add'}
        </button>
        {draft.id && (
          <button className="btn btn--ghost" onClick={() => setDraft(EMPTY)}>
            Cancel
          </button>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        {links.map((link) => (
          <div key={link.id} className="admin-row">
            <span className="link-card__icon" style={{ width: 40, height: 40 }}>
              <Icon name={link.icon} />
            </span>
            <div className="admin-row__grow">
              <strong>{link.label}</strong>
              <div className="admin-row__muted">{link.url}</div>
            </div>
            <button className="btn btn--ghost" onClick={() => toggle(link)}>
              <Icon name={link.enabled ? 'eye' : 'eye-slash'} /> {link.enabled ? 'On' : 'Off'}
            </button>
            <div className="admin-actions">
              <button
                className="btn btn--ghost"
                onClick={() =>
                  setDraft({
                    id: link.id,
                    label: link.label,
                    url: link.url,
                    icon: link.icon,
                    description: link.description || '',
                    category: link.category || '',
                    sort_order: link.sort_order,
                    enabled: link.enabled,
                  })
                }
              >
                <Icon name="pen" />
              </button>
              <button className="btn btn--danger" onClick={() => remove(link.id)}>
                <Icon name="trash" />
              </button>
            </div>
          </div>
        ))}
        {links.length === 0 && <div className="empty">No links yet.</div>}
      </div>
    </div>
  );
}

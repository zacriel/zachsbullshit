import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import type { ProjectItem } from '../types';

type Draft = {
  id?: number;
  title: string;
  description: string;
  url: string;
  repo_url: string;
  tags: string;
  icon: string;
  image_url: string;
  sort_order: number;
  enabled: boolean;
};

const EMPTY: Draft = {
  title: '',
  description: '',
  url: '',
  repo_url: '',
  tags: '',
  icon: 'cube',
  image_url: '',
  sort_order: 0,
  enabled: true,
};

export function ProjectsAdmin({ notify }: { notify: (m: string, err?: boolean) => void }) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const load = () =>
    api.get<{ projects: ProjectItem[] }>('/projects/all').then((r) => setProjects(r.projects)).catch(() => {});

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!draft.title) {
      notify('Title is required', true);
      return;
    }
    const body = {
      title: draft.title,
      description: draft.description || null,
      url: draft.url || '',
      repo_url: draft.repo_url || '',
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      icon: draft.icon || 'cube',
      image_url: draft.image_url || '',
      sort_order: Number(draft.sort_order) || 0,
      enabled: draft.enabled,
    };
    try {
      if (draft.id) await api.put(`/projects/${draft.id}`, body);
      else await api.post('/projects', body);
      setDraft(EMPTY);
      await load();
      notify('Saved');
    } catch {
      notify('Save failed', true);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this project?')) return;
    await api.del(`/projects/${id}`).catch(() => notify('Delete failed', true));
    await load();
  }

  async function toggle(p: ProjectItem) {
    await api.put(`/projects/${p.id}`, { enabled: !p.enabled }).catch(() => {});
    await load();
  }

  return (
    <div>
      <div className="admin-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: '1 1 180px' }}>
          <label>Title</label>
          <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '2 1 240px' }}>
          <label>Description</label>
          <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
          <label>Live URL</label>
          <input className="input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
          <label>Repo URL</label>
          <input className="input" value={draft.repo_url} onChange={(e) => setDraft({ ...draft, repo_url: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
          <label>Tags (comma-sep)</label>
          <input className="input" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 120px' }}>
          <label>Icon (FA name)</label>
          <input className="input" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
          <label>Image URL</label>
          <input className="input" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} />
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
        {projects.map((p) => (
          <div key={p.id} className="admin-row">
            <span className="link-card__icon" style={{ width: 40, height: 40 }}>
              <Icon name={p.icon} />
            </span>
            <div className="admin-row__grow">
              <strong>{p.title}</strong>
              <div className="admin-row__muted">{p.tags.join(' · ') || '—'}</div>
            </div>
            <button className="btn btn--ghost" onClick={() => toggle(p)}>
              <Icon name={p.enabled ? 'eye' : 'eye-slash'} /> {p.enabled ? 'On' : 'Off'}
            </button>
            <div className="admin-actions">
              <button
                className="btn btn--ghost"
                onClick={() =>
                  setDraft({
                    id: p.id,
                    title: p.title,
                    description: p.description || '',
                    url: p.url || '',
                    repo_url: p.repo_url || '',
                    tags: p.tags.join(', '),
                    icon: p.icon,
                    image_url: p.image_url || '',
                    sort_order: p.sort_order,
                    enabled: p.enabled,
                  })
                }
              >
                <Icon name="pen" />
              </button>
              <button className="btn btn--danger" onClick={() => remove(p.id)}>
                <Icon name="trash" />
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && <div className="empty">No projects yet.</div>}
      </div>
    </div>
  );
}

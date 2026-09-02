import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Section } from '../components/Section';
import type { ProjectItem } from '../types';

/**
 * Projects portfolio. Public visitors see enabled project cards. In admin
 * edit mode, cards are editable in place (title, description, links, tags,
 * icon), disabled projects show dimmed, and cards can be added or removed.
 */
export function ProjectsModule({ icon }: { icon: string }) {
  const { authed, editMode, notify } = useAuth();
  const canEdit = authed && editMode;
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    const path = canEdit ? '/projects/all' : '/projects';
    api
      .get<{ projects: ProjectItem[] }>(path)
      .then((r) => setProjects(r.projects))
      .catch(() => setError(true));
  }, [canEdit]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return null;
  if (!projects) return null;
  if (!canEdit && projects.length === 0) return null;

  const patchLocal = (id: number, patch: Partial<ProjectItem>) =>
    setProjects((prev) => (prev ? prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) : prev));

  async function saveProject(p: ProjectItem) {
    try {
      await api.put(`/projects/${p.id}`, {
        title: p.title,
        description: p.description || null,
        url: p.url || '',
        repo_url: p.repo_url || '',
        tags: p.tags,
        icon: p.icon || 'cube',
      });
      notify('Saved');
    } catch {
      notify('Save failed', true);
    }
  }

  async function toggle(p: ProjectItem) {
    patchLocal(p.id, { enabled: !p.enabled });
    await api.put(`/projects/${p.id}`, { enabled: !p.enabled }).catch(() => notify('Update failed', true));
  }

  async function remove(id: number) {
    if (!confirm('Delete this project?')) return;
    setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    await api.del(`/projects/${id}`).catch(() => notify('Delete failed', true));
  }

  async function add() {
    try {
      const { project } = await api.post<{ project: ProjectItem }>('/projects', {
        title: 'New project',
        description: 'What is it?',
        tags: [],
        icon: 'cube',
      });
      setProjects((prev) => (prev ? [...prev, project] : [project]));
    } catch {
      notify('Could not add project', true);
    }
  }

  return (
    <Section id="projects" title="Projects" icon={icon}>
      <div className="projects">
        {projects.map((p) =>
          canEdit ? (
            <article key={p.id} className={`project-card ${!p.enabled ? 'disabled-item' : ''}`}>
              <div className="project-card__body">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="link-card__icon" style={{ width: 40, height: 40, fontSize: '1rem' }}>
                    <Icon name={p.icon} />
                  </span>
                  <input className="edit-input" style={{ fontWeight: 700, fontSize: '1.1rem' }} value={p.title} placeholder="Title" onChange={(e) => patchLocal(p.id, { title: e.target.value })} onBlur={() => saveProject(p)} />
                </div>
                <textarea className="edit-input" rows={2} value={p.description || ''} placeholder="Description" onChange={(e) => patchLocal(p.id, { description: e.target.value })} onBlur={() => saveProject(p)} />
                <input className="edit-input" value={p.tags.join(', ')} placeholder="Tags (comma-separated)" onChange={(e) => patchLocal(p.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} onBlur={() => saveProject(p)} />
                <div className="edit-row">
                  <input className="edit-input" style={{ maxWidth: 100 }} value={p.icon} placeholder="fa icon" onChange={(e) => patchLocal(p.id, { icon: e.target.value })} onBlur={() => saveProject(p)} />
                  <input className="edit-input" value={p.url || ''} placeholder="Live URL" onChange={(e) => patchLocal(p.id, { url: e.target.value })} onBlur={() => saveProject(p)} />
                </div>
                <input className="edit-input" value={p.repo_url || ''} placeholder="Repo URL" onChange={(e) => patchLocal(p.id, { repo_url: e.target.value })} onBlur={() => saveProject(p)} />
                <div className="edit-card-tools">
                  <button className="btn btn--ghost btn--sm" onClick={() => toggle(p)}>
                    <Icon name={p.enabled ? 'eye' : 'eye-slash'} /> {p.enabled ? 'Visible' : 'Hidden'}
                  </button>
                  <span className="spacer" />
                  <button className="btn btn--danger btn--sm" onClick={() => remove(p.id)}>
                    <Icon name="trash" /> Delete
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <article key={p.id} className="project-card">
              {p.image_url && <img className="project-card__img" src={p.image_url} alt={p.title} loading="lazy" />}
              <div className="project-card__body">
                <h3 className="project-card__title">
                  <Icon name={p.icon} fixedWidth />
                  {p.title}
                </h3>
                {p.description && <p className="project-card__desc">{p.description}</p>}
                {p.tags.length > 0 && (
                  <div className="tags">
                    {p.tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}
                {(p.url || p.repo_url) && (
                  <div className="project-card__links">
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        <Icon name="up-right-from-square" /> Live
                      </a>
                    )}
                    {p.repo_url && (
                      <a href={p.repo_url} target="_blank" rel="noopener noreferrer">
                        <Icon name="code-branch" /> Source
                      </a>
                    )}
                  </div>
                )}
              </div>
            </article>
          ),
        )}

        {canEdit && (
          <button className="add-card" onClick={add}>
            <Icon name="plus" /> Add project
          </button>
        )}
      </div>
    </Section>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { Section } from '../components/Section';
import type { ProjectItem } from '../types';

/** Public portfolio — project cards with tags and links. */
export function ProjectsModule({ icon }: { icon: string }) {
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<{ projects: ProjectItem[] }>('/projects')
      .then((r) => setProjects(r.projects))
      .catch(() => setError(true));
  }, []);

  if (error || !projects) return null;

  return (
    <Section id="projects" title="Projects" icon={icon}>
      {projects.length === 0 ? (
        <div className="empty">No projects yet.</div>
      ) : (
        <div className="projects">
          {projects.map((p) => (
            <article key={p.id} className="project-card">
              {p.image_url && (
                <img className="project-card__img" src={p.image_url} alt={p.title} loading="lazy" />
              )}
              <div className="project-card__body">
                <h3 className="project-card__title">
                  <Icon name={p.icon} fixedWidth />
                  {p.title}
                </h3>
                {p.description && <p className="project-card__desc">{p.description}</p>}
                {p.tags.length > 0 && (
                  <div className="tags">
                    {p.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
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
          ))}
        </div>
      )}
    </Section>
  );
}

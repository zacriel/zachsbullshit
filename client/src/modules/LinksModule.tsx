import { useEffect, useState } from 'react';
import { api, trackClick } from '../api';
import { Icon } from '../components/Icon';
import { Section } from '../components/Section';
import type { LinkItem } from '../types';

/** Public links hub — grouped grid of outbound links with click tracking. */
export function LinksModule({ icon }: { icon: string }) {
  const [links, setLinks] = useState<LinkItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<{ links: LinkItem[] }>('/links')
      .then((r) => setLinks(r.links))
      .catch(() => setError(true));
  }, []);

  if (error) return null; // module unreachable — hide gracefully
  if (!links) return null; // still loading; keep layout calm

  return (
    <Section id="links" title="Links" icon={icon}>
      {links.length === 0 ? (
        <div className="empty">No links yet.</div>
      ) : (
        <div className="grid">
          {links.map((link) => (
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
          ))}
        </div>
      )}
    </Section>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { Section } from '../components/Section';
import type { AboutData } from '../types';

/**
 * About module — renders the page hero (avatar, name, headline, bio,
 * socials) plus a skills section. When disabled, App never mounts this,
 * and a minimal fallback hero is shown instead.
 */
export function AboutModule({ icon }: { icon: string }) {
  const [about, setAbout] = useState<AboutData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<{ about: AboutData }>('/about')
      .then((r) => setAbout(r.about))
      .catch(() => setError(true));
  }, []);

  if (error || !about) return null;

  const initials = (about.name || 'Z')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="hero">
        {about.avatar_url ? (
          <img className="hero__avatar" src={about.avatar_url} alt={about.name} />
        ) : (
          <div className="hero__avatar hero__avatar--fallback">{initials}</div>
        )}
        <h1>{about.name || 'Welcome'}</h1>
        {about.headline && <p className="hero__headline">{about.headline}</p>}
        {about.bio && <p className="hero__bio">{about.bio}</p>}
        {about.socials.length > 0 && (
          <div className="hero__socials">
            {about.socials.map((s) => (
              <a
                key={s.url}
                className="social-btn"
                href={s.url}
                target={s.url.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
              >
                <Icon name={s.icon} />
              </a>
            ))}
          </div>
        )}
      </header>

      {about.skills.length > 0 && (
        <Section id="about" title="Skills & Stack" icon={icon}>
          <div className="about__skills">
            {about.skills.map((skill) => (
              <span key={skill} className="tag">
                {skill}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

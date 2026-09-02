import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Section } from '../components/Section';
import type { AboutData, SocialLink } from '../types';

/**
 * About module — renders the massive jumbotron hero (avatar, name,
 * headline, bio, socials) plus a skills section. When the admin is in
 * edit mode, every field becomes editable in place and saves via PUT.
 */
export function AboutModule({ icon }: { icon: string }) {
  const { authed, editMode, notify } = useAuth();
  const [about, setAbout] = useState<AboutData | null>(null);
  const [skillsText, setSkillsText] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ about: AboutData }>('/about')
      .then((r) => {
        setAbout(r.about);
        setSkillsText(r.about.skills.join(', '));
      })
      .catch(() => setError(true));
  }, []);

  const canEdit = authed && editMode;

  if (error || !about) {
    // Fallback hero so the page never looks broken.
    if (error) return null;
    return null;
  }

  const set = (patch: Partial<AboutData>) => setAbout({ ...about, ...patch });

  async function save(next?: Partial<AboutData>) {
    if (!about) return;
    const merged = { ...about, ...next };
    setSaving(true);
    try {
      const { about: saved } = await api.put<{ about: AboutData }>('/about', {
        name: merged.name,
        headline: merged.headline || null,
        bio: merged.bio || null,
        avatar_url: merged.avatar_url || '',
        socials: merged.socials,
        skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setAbout(saved);
      setSkillsText(saved.skills.join(', '));
      notify('Saved');
    } catch {
      notify('Save failed', true);
    } finally {
      setSaving(false);
    }
  }

  const initials = (about.name || 'Z')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const updateSocial = (i: number, patch: Partial<SocialLink>) =>
    set({ socials: about.socials.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <>
      <section className="jumbo" id="top">
        {about.avatar_url ? (
          <img className="jumbo__avatar" src={about.avatar_url} alt={about.name} />
        ) : (
          <div className="jumbo__avatar jumbo__avatar--fallback">{initials}</div>
        )}

        {canEdit ? (
          <div className="jumbo__editwrap" style={{ width: '100%', maxWidth: 760 }}>
            <input
              className="edit-input edit-input--display edit-input--h1"
              value={about.name}
              placeholder="Your name"
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => save()}
            />
            <input
              className="edit-input edit-input--display edit-input--headline"
              value={about.headline || ''}
              placeholder="A short headline"
              onChange={(e) => set({ headline: e.target.value })}
              onBlur={() => save()}
              style={{ display: 'block' }}
            />
            <textarea
              className="edit-input edit-input--display edit-input--bio"
              value={about.bio || ''}
              placeholder="A sentence or two about you…"
              onChange={(e) => set({ bio: e.target.value })}
              onBlur={() => save()}
              style={{ display: 'block' }}
            />
            <div style={{ maxWidth: 560, margin: '18px auto 0' }}>
              <input
                className="edit-input"
                value={about.avatar_url || ''}
                placeholder="Avatar image URL (optional)"
                onChange={(e) => set({ avatar_url: e.target.value })}
                onBlur={() => save()}
              />
            </div>

            <div style={{ marginTop: 20, textAlign: 'left', maxWidth: 560, marginInline: 'auto' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 8px', textAlign: 'center' }}>
                Social links
              </p>
              {about.socials.map((s, i) => (
                <div className="edit-row" key={i}>
                  <input className="edit-input" placeholder="Label" value={s.label} onChange={(e) => updateSocial(i, { label: e.target.value })} onBlur={() => save()} />
                  <input className="edit-input" placeholder="URL" value={s.url} onChange={(e) => updateSocial(i, { url: e.target.value })} onBlur={() => save()} />
                  <input className="edit-input" style={{ maxWidth: 120 }} placeholder="fa icon" value={s.icon} onChange={(e) => updateSocial(i, { icon: e.target.value })} onBlur={() => save()} />
                  <button className="btn btn--danger btn--icon" onClick={() => save({ socials: about.socials.filter((_, j) => j !== i) })} title="Remove">
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
              <button
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 10 }}
                onClick={() => set({ socials: [...about.socials, { label: '', url: '', icon: 'link' }] })}
              >
                <Icon name="plus" /> Add social
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1>{about.name || 'Welcome'}</h1>
            {about.headline && <p className="jumbo__headline">{about.headline}</p>}
            {about.bio && <p className="jumbo__bio">{about.bio}</p>}
            {about.socials.length > 0 && (
              <div className="jumbo__socials">
                {about.socials.map((s) => (
                  <a
                    key={s.url + s.label}
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
          </>
        )}

        {!canEdit && (
          <a className="jumbo__scroll" href="#links" aria-label="Scroll down">
            <Icon name="chevron-down" />
          </a>
        )}
        {saving && <span style={{ position: 'absolute', top: 100, right: 20, color: 'var(--text-faint)', fontSize: '0.8rem' }}><Icon name="spinner" spin /> saving</span>}
      </section>

      {(canEdit || about.skills.length > 0) && (
        <Section id="about" title="Skills & Stack" icon={icon}>
          {canEdit ? (
            <div className="about">
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Skills (comma-separated)
              </label>
              <input
                className="input"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                onBlur={() => save()}
                placeholder="TypeScript, React, Node.js…"
              />
              <div className="about__skills" style={{ marginTop: 16 }}>
                {skillsText.split(',').map((s) => s.trim()).filter(Boolean).map((skill) => (
                  <span key={skill} className="tag">{skill}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="about">
              <div className="about__skills">
                {about.skills.map((skill) => (
                  <span key={skill} className="tag">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import type { AboutData, SocialLink } from '../types';

export function AboutAdmin({ notify }: { notify: (m: string, err?: boolean) => void }) {
  const [about, setAbout] = useState<AboutData | null>(null);
  const [skills, setSkills] = useState('');
  const [socials, setSocials] = useState<SocialLink[]>([]);

  useEffect(() => {
    api
      .get<{ about: AboutData }>('/about')
      .then((r) => {
        setAbout(r.about);
        setSkills(r.about.skills.join(', '));
        setSocials(r.about.socials);
      })
      .catch(() => {});
  }, []);

  if (!about) return <div className="empty">Loading…</div>;

  const set = (patch: Partial<AboutData>) => setAbout({ ...about, ...patch });

  async function save() {
    if (!about) return;
    try {
      await api.put('/about', {
        name: about.name,
        headline: about.headline || null,
        bio: about.bio || null,
        avatar_url: about.avatar_url || '',
        socials,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      notify('Saved');
    } catch {
      notify('Save failed', true);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="field">
        <label>Name</label>
        <input className="input" value={about.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field">
        <label>Headline</label>
        <input className="input" value={about.headline || ''} onChange={(e) => set({ headline: e.target.value })} />
      </div>
      <div className="field">
        <label>Bio</label>
        <textarea className="textarea" value={about.bio || ''} onChange={(e) => set({ bio: e.target.value })} />
      </div>
      <div className="field">
        <label>Avatar URL</label>
        <input className="input" value={about.avatar_url || ''} onChange={(e) => set({ avatar_url: e.target.value })} />
      </div>
      <div className="field">
        <label>Skills (comma-separated)</label>
        <input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} />
      </div>

      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Socials</label>
      {socials.map((s, i) => (
        <div key={i} className="admin-row" style={{ marginTop: 8 }}>
          <input
            className="input"
            placeholder="Label"
            value={s.label}
            onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
          />
          <input
            className="input"
            placeholder="URL"
            value={s.url}
            onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
          />
          <input
            className="input"
            style={{ width: 140 }}
            placeholder="FA icon"
            value={s.icon}
            onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)))}
          />
          <button className="btn btn--danger" onClick={() => setSocials(socials.filter((_, j) => j !== i))}>
            <Icon name="trash" />
          </button>
        </div>
      ))}
      <button className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setSocials([...socials, { label: '', url: '', icon: 'link' }])}>
        <Icon name="plus" /> Add social
      </button>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn--primary" onClick={save}>
          <Icon name="floppy-disk" /> Save about
        </button>
      </div>
    </div>
  );
}

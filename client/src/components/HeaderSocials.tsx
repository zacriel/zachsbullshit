import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';
import { IconPicker } from './IconPicker';

interface SocialIcon {
  icon: string;
  url: string;
  label?: string;
}

const MAX = 6;

/**
 * A row of up to six social/nav icons in the header. Visitors see the filled
 * ones; in admin edit mode it becomes an (invisible) 6-slot grid you fill in.
 * Stored site-wide under the `header_icons` setting.
 */
export function HeaderSocials() {
  const { authed, editMode, notify } = useAuth();
  const [icons, setIcons] = useState<SocialIcon[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<SocialIcon>({ icon: 'link', url: '', label: '' });

  useEffect(() => {
    api
      .get<{ value: SocialIcon[] | null }>('/settings/header_icons')
      .then((r) => setIcons(Array.isArray(r.value) ? r.value.slice(0, MAX) : []))
      .catch(() => {});
  }, []);

  const editing = !!authed && editMode;

  function persist(next: SocialIcon[]) {
    const clean = next.filter((x) => x && x.url).slice(0, MAX);
    setIcons(clean);
    api.put('/settings/header_icons', { value: clean }).then(() => notify('Saved')).catch(() => notify('Save failed', true));
  }

  function openEditor(i: number) {
    setEditingIndex(i);
    setDraft(icons[i] ? { ...icons[i] } : { icon: 'link', url: '', label: '' });
  }

  function saveEditor() {
    if (editingIndex === null) return;
    const next = [...icons];
    next[editingIndex] = draft;
    persist(next);
    setEditingIndex(null);
  }

  function removeAt(i: number) {
    persist(icons.filter((_, j) => j !== i));
    setEditingIndex(null);
  }

  // View mode (visitors + signed-in-but-not-editing): just the filled icons.
  if (!editing) {
    if (icons.length === 0) return null;
    return (
      <div className="header__socials">
        {icons.map((it, i) =>
          it.url ? (
            <a
              key={i}
              className="header__social"
              href={it.url}
              target={it.url.startsWith('mailto:') ? undefined : '_blank'}
              rel="noopener noreferrer"
              aria-label={it.label || it.icon}
              title={it.label || ''}
            >
              <Icon name={it.icon || 'link'} />
            </a>
          ) : null,
        )}
      </div>
    );
  }

  // Edit mode: an invisible 6-slot grid.
  return (
    <>
      <div className="header__socials header__socials--edit" title="Header social icons">
        {Array.from({ length: MAX }).map((_, i) => {
          const it = icons[i];
          return it ? (
            <button key={i} className="header__social" onClick={() => openEditor(i)} title="Edit icon">
              <Icon name={it.icon || 'link'} />
            </button>
          ) : (
            <button key={i} className="header__social header__social--empty" onClick={() => openEditor(i)} title="Add icon">
              <Icon name="plus" />
            </button>
          );
        })}
      </div>

      {editingIndex !== null && (
        <div className="modal-scrim" onMouseDown={() => setEditingIndex(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span className="section__icon"><Icon name={draft.icon || 'link'} /></span>
              <h2 style={{ fontSize: '1.15rem' }}>Header icon</h2>
            </div>
            <div className="field">
              <label>Link URL</label>
              <input className="input" value={draft.url} placeholder="https://…  or mailto:…" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </div>
            <div className="field">
              <label>Label (tooltip)</label>
              <input className="input" value={draft.label || ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div className="field">
              <label>Icon</label>
              <IconPicker value={draft.icon} onChange={(v) => setDraft({ ...draft, icon: v })} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {icons[editingIndex] && (
                <button className="btn btn--danger btn--sm" onClick={() => removeAt(editingIndex)}>
                  <Icon name="trash" /> Remove
                </button>
              )}
              <span style={{ flex: 1 }} />
              <button className="btn btn--ghost" onClick={() => setEditingIndex(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={saveEditor} disabled={!draft.url}>
                <Icon name="check" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

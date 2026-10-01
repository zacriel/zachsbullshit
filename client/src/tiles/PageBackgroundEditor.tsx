import { useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAppearance } from '../appearance/AppearanceContext';
import { Icon } from '../components/Icon';
import { ImageField } from './TileEditor';
import type { Page, PageBackground } from '../types';

type Mode = 'default' | PageBackground['mode'];

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'default', label: 'Site default', icon: 'globe' },
  { id: 'gradient', label: 'Gradient', icon: 'wand-magic-sparkles' },
  { id: 'aurora', label: 'Aurora', icon: 'cloud-moon' },
  { id: 'particles', label: 'Particles', icon: 'diagram-project' },
  { id: 'off', label: 'Solid', icon: 'square' },
  { id: 'media', label: 'Image / video', icon: 'image' },
];

const SITE_LABEL: Record<string, string> = { gradient: 'Gradient', aurora: 'Aurora', particles: 'Particles', off: 'Solid' };

/**
 * Per-page background picker. Changes preview live behind the (light) scrim;
 * Cancel restores the saved background, Save persists it to the page.
 */
export function PageBackgroundEditor({
  page,
  onSave,
  onClose,
}: {
  page: Page;
  onSave: (bg: PageBackground | null) => void;
  onClose: () => void;
}) {
  const { notify } = useAuth();
  const { appearance, setPageBackground } = useAppearance();
  const init = page.background ?? null;

  const [mode, setMode] = useState<Mode>(init ? init.mode : 'default');
  const [mediaUrl, setMediaUrl] = useState(init?.media_url || '');
  const [dim, setDim] = useState(init?.dim ?? 55);
  const [blur, setBlur] = useState(init?.blur ?? 0);
  const [saving, setSaving] = useState(false);

  const draft: PageBackground | null =
    mode === 'default'
      ? null
      : mode === 'media'
        ? { mode, media_url: mediaUrl.trim(), dim, blur }
        : { mode };

  // Live preview while the editor is open.
  useEffect(() => {
    setPageBackground(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mediaUrl, dim, blur]);

  const needsUrl = mode === 'media' && !mediaUrl.trim();

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  const slider = (label: string, val: number, set: (n: number) => void, min: number, max: number, unit: string) => (
    <div className="appx__ctl">
      <div className="appx__ctl-row">
        <label>{label}</label>
        <span className="appx__ctl-val">{val}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={1} value={val}
        className="appx__range"
        style={{ ['--fill']: ((val - min) / (max - min)) * 100 + '%' } as CSSProperties}
        onChange={(e) => set(Number(e.target.value))}
      />
    </div>
  );

  return (
    <div className="modal-scrim modal-scrim--clear" onMouseDown={onClose}>
      <div className="modal modal--editor" style={{ maxWidth: 580 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="section__icon"><Icon name="image" /></span>
          <h2 style={{ fontSize: '1.2rem' }}>Background — “{page.name}”</h2>
        </div>

        <div className="modal__body">
          <p className="admin-row__muted pagebg__hint">
            Optional. Leave on <strong>Site default</strong> to use the background from Admin → Appearance
            (currently {SITE_LABEL[appearance.background] || appearance.background}). Changes preview live.
          </p>

          <div className="appx__bgs pagebg__modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`appx__bg ${mode === m.id ? 'appx__bg--on' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <Icon name={m.icon} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {mode === 'aurora' && (
            <p className="admin-row__muted pagebg__hint">Uses the aurora tuning from Admin → Appearance.</p>
          )}

          {mode === 'media' && (
            <div className="appx__sliders">
              <ImageField label="Image or video (mp4 / webm)" value={mediaUrl} onChange={setMediaUrl} notify={notify} />
              {slider('Darken', dim, setDim, 0, 95, '%')}
              {slider('Blur', blur, setBlur, 0, 40, 'px')}
            </div>
          )}
        </div>

        <div className="modal__foot">
          {needsUrl && <span className="admin-row__muted" style={{ fontSize: '0.83rem' }}>Pick an image or video to save.</span>}
          <span style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={saving || needsUrl}>
            {saving ? <Icon name="spinner" spin /> : <Icon name="floppy-disk" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

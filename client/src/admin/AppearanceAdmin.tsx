import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useAppearance, APPEARANCE_DEFAULTS, type Appearance } from '../appearance/AppearanceContext';

const BACKGROUNDS: { id: Appearance['background']; label: string; icon: string }[] = [
  { id: 'gradient', label: 'Gradient', icon: 'wand-magic-sparkles' },
  { id: 'aurora', label: 'Aurora', icon: 'cloud-moon' },
  { id: 'particles', label: 'Particles', icon: 'diagram-project' },
  { id: 'off', label: 'Solid', icon: 'square' },
];

const HUE_PRESETS = [262, 220, 190, 155, 90, 40, 12, 330];

/**
 * Master controls for the whole site's look & interactivity. Everything here is
 * a default; individual tiles can override the per-tile effects in their own
 * editor, so control stays fully granular.
 */
export function AppearanceAdmin({ notify }: { notify: (m: string, e?: boolean) => void }) {
  const { appearance, setLocal, save } = useAppearance();
  const [saving, setSaving] = useState(false);
  const a = appearance;

  async function persist() {
    setSaving(true);
    try {
      await save(a);
      notify('Appearance saved');
    } catch {
      notify('Save failed', true);
    } finally {
      setSaving(false);
    }
  }

  const hue = a.accent ?? 262;

  return (
    <div className="appx">
      <section className="appx__group">
        <h3 className="appx__title"><Icon name="image" /> Background</h3>
        <div className="appx__bgs">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              className={`appx__bg ${a.background === b.id ? 'appx__bg--on' : ''}`}
              onClick={() => setLocal({ background: b.id })}
            >
              <Icon name={b.icon} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="appx__group">
        <h3 className="appx__title"><Icon name="palette" /> Accent color</h3>
        <label className="editor-toggle" style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={a.accent == null}
            onChange={(e) => setLocal({ accent: e.target.checked ? null : hue })}
          />
          Use theme default (royal purple)
        </label>
        {a.accent != null && (
          <>
            <div className="appx__hue-row">
              <input
                type="range"
                min={0}
                max={360}
                value={hue}
                className="appx__hue"
                onChange={(e) => setLocal({ accent: Number(e.target.value) })}
              />
              <span className="appx__swatch" style={{ background: `hsl(${hue} 74% 55%)` }} />
            </div>
            <div className="appx__presets">
              {HUE_PRESETS.map((p) => (
                <button
                  key={p}
                  className={`appx__preset ${hue === p ? 'appx__preset--on' : ''}`}
                  style={{ background: `hsl(${p} 74% 55%)` }}
                  onClick={() => setLocal({ accent: p })}
                  aria-label={`Hue ${p}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="appx__group">
        <h3 className="appx__title"><Icon name="wand-sparkles" /> Interactivity (master defaults)</h3>
        <p className="admin-row__muted" style={{ marginTop: -4, marginBottom: 12, fontSize: '0.85rem' }}>
          Each tile can override these in its own editor.
        </p>
        <Switch label="Cursor spotlight on tiles" checked={a.spotlight} onChange={(v) => setLocal({ spotlight: v })} />
        <Switch label="3D hover tilt on tiles" checked={a.tilt} onChange={(v) => setLocal({ tilt: v })} />
        <Switch label="Click-to-expand tiles (lightbox)" checked={a.expand} onChange={(v) => setLocal({ expand: v })} />
        <Switch label="Text-scramble reveal (headings & banners)" checked={a.scramble} onChange={(v) => setLocal({ scramble: v })} />
      </section>

      <section className="appx__group">
        <h3 className="appx__title"><Icon name="terminal" /> Boot intro</h3>
        <Switch label="Show a boot-sequence intro on load" checked={a.boot.enabled} onChange={(v) => setLocal({ boot: { ...a.boot, enabled: v } })} />
        {a.boot.enabled && (
          <>
            <Switch label="Only once per browsing session" checked={a.boot.once} onChange={(v) => setLocal({ boot: { ...a.boot, once: v } })} />
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Boot title</label>
              <input className="input" value={a.boot.title} onChange={(e) => setLocal({ boot: { ...a.boot, title: e.target.value } })} />
            </div>
          </>
        )}
      </section>

      <div className="appx__foot">
        <button className="btn btn--ghost" onClick={() => setLocal(APPEARANCE_DEFAULTS)}>
          <Icon name="rotate-left" /> Reset
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn--primary" onClick={persist} disabled={saving}>
          {saving ? <Icon name="spinner" spin /> : <Icon name="floppy-disk" />} Save changes
        </button>
      </div>
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="editor-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

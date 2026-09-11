import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';

/**
 * Site-wide appearance & interactivity settings, persisted under the public
 * `appearance` setting. These are the master switches; individual tiles can
 * override the per-tile effects (spotlight, tilt, expand, scramble) so control
 * is fully granular — a global default plus a per-tile opt-in/out.
 */
export interface Appearance {
  background: 'gradient' | 'aurora' | 'particles' | 'off';
  accent: number | null; // hue 0–360; null = theme default
  spotlight: boolean; // cursor glow on tiles (master default)
  tilt: boolean; // 3D hover tilt on tiles (master default)
  scramble: boolean; // text-scramble reveal on headings/banners (master default)
  expand: boolean; // click-to-expand tiles into a lightbox (master allow)
  boot: { enabled: boolean; once: boolean; title: string };
}

export const APPEARANCE_DEFAULTS: Appearance = {
  background: 'gradient',
  accent: null,
  spotlight: true,
  tilt: true,
  scramble: true,
  expand: true,
  boot: { enabled: false, once: true, title: 'zachsbullshit' },
};

interface AppearanceState {
  appearance: Appearance;
  loaded: boolean;
  /** Optimistically update locally (no persistence). */
  setLocal: (patch: Partial<Appearance>) => void;
  /** Persist the whole object (admin only). */
  save: (next: Appearance) => Promise<void>;
}

const Ctx = createContext<AppearanceState | null>(null);

export function useAppearance(): AppearanceState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppearance must be used inside <AppearanceProvider>');
  return v;
}

/** Per-tile effect override: 'on'/'off' win; anything else falls back to the master. */
export function resolveFx(override: unknown, master: boolean): boolean {
  if (override === 'on' || override === true) return true;
  if (override === 'off' || override === false) return false;
  return master;
}

/** Paint the accent palette from a single hue (or clear back to the theme default). */
function applyAccent(hue: number | null) {
  const root = document.documentElement;
  const vars: [string, string][] = hue == null
    ? []
    : [
        ['--accent', `hsl(${hue} 74% 55%)`],
        ['--accent-bright', `hsl(${hue} 88% 72%)`],
        ['--accent-deep', `hsl(${hue} 72% 42%)`],
        ['--accent-soft', `hsla(${hue} 74% 55% / 0.15)`],
        ['--accent-line', `hsla(${hue} 70% 62% / 0.38)`],
        ['--shadow-accent', `0 12px 40px -10px hsla(${hue} 74% 55% / 0.5)`],
        ['--grad-3', `hsl(${hue} 60% 30%)`],
        ['--grad-2', `hsl(${hue} 55% 14%)`],
      ];
  const keys = ['--accent', '--accent-bright', '--accent-deep', '--accent-soft', '--accent-line', '--shadow-accent', '--grad-3', '--grad-2'];
  if (hue == null) keys.forEach((k) => root.style.removeProperty(k));
  else vars.forEach(([k, v]) => root.style.setProperty(k, v));
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(APPEARANCE_DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get<{ value: Partial<Appearance> | null }>('/settings/appearance')
      .then((r) => {
        if (r.value) setAppearance((a) => ({ ...a, ...r.value, boot: { ...a.boot, ...(r.value?.boot || {}) } }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Live-apply the accent whenever it changes.
  useEffect(() => {
    applyAccent(appearance.accent);
  }, [appearance.accent]);

  const setLocal = useCallback((patch: Partial<Appearance>) => {
    setAppearance((a) => ({ ...a, ...patch }));
  }, []);

  const save = useCallback(async (next: Appearance) => {
    setAppearance(next);
    await api.put('/settings/appearance', { value: next });
  }, []);

  return <Ctx.Provider value={{ appearance, loaded, setLocal, save }}>{children}</Ctx.Provider>;
}

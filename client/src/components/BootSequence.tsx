import { useEffect, useRef, useState } from 'react';
import { useAppearance } from '../appearance/AppearanceContext';

/**
 * A skippable homelab-style "boot log" that plays over the site on load, then
 * fades to reveal the dashboard. Enabled (and once-per-session vs every-load)
 * from Appearance settings. Reduced-motion users skip it entirely.
 */
export function BootSequence() {
  const { appearance, loaded } = useAppearance();
  const { enabled, once, title } = appearance.boot;
  const [phase, setPhase] = useState<'boot' | 'closing' | 'done'>('done');
  const [lines, setLines] = useState<string[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!loaded) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try {
      seen = once && sessionStorage.getItem('zbs_booted') === '1';
    } catch {
      /* ignore */
    }
    if (!enabled || reduce || seen) {
      setPhase('done');
      return;
    }

    setPhase('boot');
    const script = [
      `${title} — system boot`,
      'BIOS check .............. OK',
      'mounting /dev/homelab ... OK',
      'starting services ....... OK',
      'minecraft.service ....... online',
      'reverse-proxy ........... online',
      'loading dashboard ....... OK',
      'welcome back, operator.',
    ];
    script.forEach((ln, i) => {
      const t = window.setTimeout(() => setLines((prev) => [...prev, ln]), 260 + i * 260);
      timers.current.push(t);
    });
    const closeAt = 260 + script.length * 260 + 500;
    timers.current.push(window.setTimeout(() => setPhase('closing'), closeAt));
    timers.current.push(
      window.setTimeout(() => {
        setPhase('done');
        try {
          if (once) sessionStorage.setItem('zbs_booted', '1');
        } catch {
          /* ignore */
        }
      }, closeAt + 600),
    );
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [loaded, enabled, once, title]);

  function skip() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPhase('closing');
    window.setTimeout(() => setPhase('done'), 500);
    try {
      if (once) sessionStorage.setItem('zbs_booted', '1');
    } catch {
      /* ignore */
    }
  }

  if (phase === 'done') return null;

  return (
    <div className={`boot ${phase === 'closing' ? 'boot--closing' : ''}`} onClick={skip} role="button" aria-label="Skip intro">
      <div className="boot__screen">
        <pre className="boot__log">
          {lines.map((ln, i) => (
            <div key={i} className="boot__line">
              <span className="boot__prompt">›</span> {ln}
            </div>
          ))}
          <span className="boot__cursor" />
        </pre>
        <div className="boot__hint">click anywhere to skip</div>
      </div>
    </div>
  );
}

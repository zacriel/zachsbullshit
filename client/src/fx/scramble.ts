import { useEffect, useState } from 'react';

/**
 * Reveals `text` with a brief "decode" scramble on mount (and whenever the text
 * changes) when `active`. Reduced-motion users and empty strings get the final
 * text immediately.
 */
export function useScramble(text: string, active: boolean): string {
  const [out, setOut] = useState(active ? '' : text);

  useEffect(() => {
    if (!active || !text) {
      setOut(text);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setOut(text);
      return;
    }
    const glyphs = '!<>-_\\/[]{}—=+*^?#________';
    const total = Math.min(52, text.length * 3 + 8);
    let frame = 0;
    let raf = 0;
    const tick = () => {
      const revealed = Math.floor((frame / total) * text.length);
      let s = '';
      for (let i = 0; i < text.length; i++) {
        if (i < revealed || text[i] === ' ') s += text[i];
        else s += glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      setOut(s);
      frame += 1;
      if (frame <= total) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active]);

  return out;
}

import { useEffect, useRef } from 'react';
import { useAppearance } from '../appearance/AppearanceContext';

/**
 * The animated site background. Mode is chosen in Appearance settings:
 *   gradient  — the original flowing charcoal→purple gradient
 *   aurora    — soft drifting light blobs that lean toward the cursor
 *   particles — a cursor-reactive constellation on a canvas
 *   off       — a plain solid ground
 */
export function BackgroundFX() {
  const { appearance } = useAppearance();
  const mode = appearance.background;

  if (mode === 'off') return <div className="bg-solid" aria-hidden="true" />;
  if (mode === 'aurora') return <Aurora />;
  if (mode === 'particles') return <Particles />;
  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <div className="gradient-veil" aria-hidden="true" />
    </>
  );
}

function Aurora() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      document.documentElement.style.setProperty('--aurora-x', `${x * 26}px`);
      document.documentElement.style.setProperty('--aurora-y', `${y * 26}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora__blob aurora__blob--1" />
      <span className="aurora__blob aurora__blob--2" />
      <span className="aurora__blob aurora__blob--3" />
      <div className="gradient-veil" />
    </div>
  );
}

function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const context = cv.getContext('2d');
    if (!context) return;
    const canvas = cv;
    const ctx = context;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };

    type P = { x: number; y: number; vx: number; vy: number };
    let pts: P[] = [];

    function accent(): string {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-bright').trim();
      return v || '#a884ff';
    }

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, (w * h) / 16000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    }

    let raf = 0;
    function frame() {
      ctx.clearRect(0, 0, w, h);
      const col = accent();
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        // Gentle drift toward the cursor.
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 26000) {
          p.vx += (dx / (d2 + 400)) * 6;
          p.vy += (dy / (d2 + 400)) * 6;
        }
        p.vx = Math.max(-0.9, Math.min(0.9, p.vx));
        p.vy = Math.max(-0.9, Math.min(0.9, p.vy));
      }
      // Links.
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.globalAlpha = (1 - dist / 130) * 0.5;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = col;
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    resize();
    frame();
    const onResize = () => resize();
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="particles-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="particles-bg__canvas" />
      <div className="gradient-veil" />
    </div>
  );
}

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

// Base band definitions (fractions of viewport height); colours are aurora hues.
const AURORA_RIBBONS = [
  { hue: 150, baseY: 0.36, amp1: 0.11, f1: 0.8, s1: 0.13, amp2: 0.05, f2: 2.1, s2: 0.19, thick: 0.30, bright: 1.0, seed: 1.3 },
  { hue: 168, baseY: 0.45, amp1: 0.13, f1: 0.6, s1: 0.10, amp2: 0.06, f2: 1.7, s2: 0.15, thick: 0.34, bright: 0.9, seed: 4.1 },
  { hue: 282, baseY: 0.54, amp1: 0.09, f1: 1.1, s1: 0.16, amp2: 0.04, f2: 2.6, s2: 0.22, thick: 0.22, bright: 0.55, seed: 2.7 },
  { hue: 192, baseY: 0.28, amp1: 0.10, f1: 0.9, s1: 0.12, amp2: 0.05, f2: 2.3, s2: 0.18, thick: 0.20, bright: 0.6, seed: 5.5 },
  { hue: 128, baseY: 0.60, amp1: 0.08, f1: 1.3, s1: 0.14, amp2: 0.05, f2: 3.0, s2: 0.20, thick: 0.24, bright: 0.7, seed: 3.3 },
];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Flowing northern-lights curtains on a canvas: sweeping ribbons with vertical
 * rays and additive glow over a starry sky. Every load rolls a fresh, tasteful
 * set of parameters (the playground "randomizer", baked in) so the aurora is
 * never quite the same twice.
 */
function Aurora() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const TAU = Math.PI * 2;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const context = cv.getContext('2d');
    if (!context) return;
    const canvas = cv;
    const ctx = context;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Randomized-but-tasteful parameters, centred on a look that reads well.
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const P = {
      count: Math.round(rnd(3, 5)),
      spread: rnd(15, 32), // curtain height, % (÷26 = scale)
      wisp: rnd(0.5, 0.9),
      wave: rnd(0.85, 1.5),
      blur: rnd(2, 10),
      intensity: rnd(0.62, 0.92),
      sat: rnd(95, 120),
      hue: rnd(-40, 45),
      speed: rnd(0.5, 1.25),
    };
    cv.style.filter = `blur(${P.blur.toFixed(1)}px)`;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let stars: { x: number; y: number; r: number; a: number }[] = [];
    let tiles: HTMLCanvasElement[] = [];

    function makeTiles() {
      tiles = AURORA_RIBBONS.map((rb) => {
        const [r, g, b] = hslToRgb(rb.hue + P.hue, P.sat, 62);
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 128;
        const gc = c.getContext('2d')!;
        const grd = gc.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grd.addColorStop(0.5, `rgba(${r},${g},${b},0.20)`);
        grd.addColorStop(0.86, `rgba(${r},${g},${b},0.80)`);
        grd.addColorStop(0.97, `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)},0.95)`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0.25)`);
        gc.fillStyle = grd;
        gc.fillRect(0, 0, 1, 128);
        return c;
      });
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.8,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.5 + 0.2,
      }));
    }

    const wisp = (x: number, seed: number, t: number) => {
      const v =
        Math.sin(x * 6.0 + seed * 1.7 + t * 0.7) +
        Math.sin(x * 15.0 - seed * 2.3 - t * 1.1) +
        Math.sin(x * 2.4 + seed * 0.5 + t * 0.4);
      return 0.5 + v / 6;
    };

    function draw(t: number) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#04040c');
      sky.addColorStop(0.5, '#080a1a');
      sky.addColorStop(1, '#0d1430');
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      const colW = 3;
      const spreadScale = P.spread / 26;
      for (let ri = 0; ri < P.count; ri++) {
        const rb = AURORA_RIBBONS[ri];
        const tile = tiles[ri];
        for (let x = 0; x <= W; x += colW) {
          const x01 = x / W;
          const cy =
            (rb.baseY +
              rb.amp1 * P.wave * Math.sin(TAU * rb.f1 * x01 + t * rb.s1) +
              rb.amp2 * P.wave * Math.sin(TAU * rb.f2 * x01 - t * rb.s2 + rb.seed)) * H;
          const rayH = H * rb.thick * spreadScale * (1 - P.wisp * 0.55 + P.wisp * wisp(x01, rb.seed, t));
          const a = rb.bright * P.intensity * (1 - P.wisp * 0.65 + P.wisp * wisp(x01 + 3.7, rb.seed + 9, t * 1.3));
          ctx.globalAlpha = Math.max(0, Math.min(1, a));
          ctx.drawImage(tile, 0, 0, 1, 128, x, cy - rayH, colW + 1, rayH + H * 0.05);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    let t = 0;
    let last = 0;
    let raf = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      t += dt * P.speed;
      draw(t);
      raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      resize();
      if (reduce) draw(t);
    };
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      canvas.style.transform = `translate(${x * 16}px, ${y * 12}px) scale(1.05)`;
    };

    resize();
    makeTiles();
    window.addEventListener('resize', onResize);
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true });
      raf = requestAnimationFrame(frame);
    } else {
      draw(0);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="aurora" aria-hidden="true">
      <canvas ref={canvasRef} className="aurora-canvas" />
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

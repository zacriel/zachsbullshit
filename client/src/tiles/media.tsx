import { useEffect, useRef } from 'react';

/** True for background URLs that point at a video file. */
export function isVideo(url?: string | null): boolean {
  return !!url && /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

/**
 * A cover background layer for a tile — an <img> or autoplaying muted <video>
 * depending on the URL. Optional JS parallax translates the layer against
 * scroll (works despite ancestor transforms and on mobile, unlike the CSS
 * background-attachment:fixed trick).
 */
export function TileMedia({
  src,
  parallax = false,
  audio = false,
  className = '',
}: {
  src: string;
  parallax?: boolean;
  /** Play the video's audio track (only meaningful for video sources). */
  audio?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parallax) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // How far the layer's center is from the viewport center.
      const offset = rect.top + rect.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${offset * -0.15}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [parallax, src]);

  return (
    <div ref={ref} className={`tile-media ${parallax ? 'tile-media--parallax' : ''} ${className}`}>
      {isVideo(src) ? (
        <video className="tile-media__el" src={src} autoPlay muted={!audio} loop playsInline preload="metadata" />
      ) : (
        <img className="tile-media__el" src={src} alt="" />
      )}
    </div>
  );
}

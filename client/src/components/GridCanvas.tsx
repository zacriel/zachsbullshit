import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';
import { TileView } from '../tiles/TileView';
import { TileEditor } from '../tiles/TileEditor';
import { TileMedia, isVideo } from '../tiles/media';
import { PALETTE, TILE_DEFAULTS } from '../tiles/defaults';
import { PagesContext, type PagesCtx } from '../tiles/PagesContext';
import type { Page, ServiceStatus, Tile, TileType } from '../types';

const ResponsiveGrid = WidthProvider(Responsive);
const COLS = 12;
const ROW_H = 92;

// Tile types that take the full row in the mobile 2-column layout.
const MOBILE_WIDE = new Set<string>(['banner', 'heading', 'embed', 'contact', 'rss', 'project', 'text', 'tabs']);

/** Read the active-page slug from the URL hash (#p=<slug>), if present. */
function readHashSlug(): string | null {
  const m = /[#&]p=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Content-aware minimum grid size for a tile, so it can't be resized small
 * enough to clip its contents. Grows with the amount of text a tile holds.
 */
function tileMins(t: Tile): { minW: number; minH: number } {
  switch (t.type) {
    case 'banner':
      return { minW: 4, minH: 2 };
    case 'heading':
      return { minW: 2, minH: 1 };
    case 'link':
      return { minW: 2, minH: 1 };
    case 'service':
      return { minW: 2, minH: 2 };
    case 'project':
      return { minW: 2, minH: 2 };
    case 'text':
      return { minW: 2, minH: 1 };
    case 'contact':
      return { minW: 3, minH: 3 };
    case 'icons':
      return { minW: 2, minH: 1 };
    case 'download':
      return { minW: 2, minH: 2 };
    case 'embed':
      return { minW: 3, minH: 3 };
    case 'command':
      return { minW: 2, minH: 1 };
    case 'clock':
      return { minW: 2, minH: 1 };
    case 'weather':
      return { minW: 2, minH: 2 };
    case 'rss':
      return { minW: 2, minH: 2 };
    case 'tabs':
      return { minW: 2, minH: 1 };
    default:
      return { minW: 1, minH: 1 };
  }
}

/**
 * The dashboard: a responsive, drag-and-resize grid of tiles, organised into
 * pages you switch between with a tabs tile. Visitors see the saved layout
 * (static); the admin in edit mode can drag, resize, add, edit, and remove
 * tiles, add/rename/reorder pages, with everything saved back to the server.
 */
export function GridCanvas() {
  const { authed, editMode, notify } = useAuth();
  const canEdit = !!authed && editMode;

  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<number | null>(null);
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [statuses, setStatuses] = useState<Record<number, ServiceStatus>>({});
  const [editing, setEditing] = useState<Tile | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  // On phones we abandon the drag-grid for a clean natural-height stack.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // ---- Pages -------------------------------------------------------------
  const loadPages = useCallback(async (): Promise<Page[]> => {
    try {
      const r = await api.get<{ pages: Page[] }>('/tiles/pages');
      setPages(r.pages);
      return r.pages;
    } catch {
      setPages([]);
      return [];
    }
  }, []);

  useEffect(() => {
    loadPages().then((pgs) => {
      setActivePageId((cur) => {
        if (cur && pgs.some((p) => p.id === cur)) return cur;
        const slug = readHashSlug();
        const bySlug = slug ? pgs.find((p) => p.slug === slug) : null;
        return (bySlug || pgs[0])?.id ?? null;
      });
    });
  }, [loadPages]);

  // Follow browser back/forward between pages.
  useEffect(() => {
    const onHash = () => {
      const slug = readHashSlug();
      const p = slug ? pages.find((x) => x.slug === slug) : pages[0];
      if (p) setActivePageId(p.id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [pages]);

  // Keep the URL hash in sync with the active page (first page = no hash).
  useEffect(() => {
    if (!activePageId || pages.length === 0) return;
    const p = pages.find((x) => x.id === activePageId);
    if (!p) return;
    const isFirst = pages[0]?.id === activePageId;
    const target = isFirst ? '' : `#p=${encodeURIComponent(p.slug)}`;
    if ((window.location.hash || '') !== target) {
      window.history.replaceState(null, '', target || window.location.pathname + window.location.search);
    }
  }, [activePageId, pages]);

  const setActivePage = useCallback((id: number) => {
    setActivePageId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const addPage = useCallback(async (name: string) => {
    try {
      const { page } = await api.post<{ page: Page }>('/tiles/pages', { name });
      setPages((prev) => [...prev, page]);
      setActivePageId(page.id);
      notify('Page added');
    } catch {
      notify('Could not add page', true);
    }
  }, [notify]);

  const renamePage = useCallback(async (id: number, name: string) => {
    try {
      const { page } = await api.put<{ page: Page }>(`/tiles/pages/${id}`, { name });
      setPages((prev) => prev.map((p) => (p.id === id ? page : p)));
    } catch {
      notify('Rename failed', true);
    }
  }, [notify]);

  const deletePage = useCallback(async (id: number) => {
    try {
      await api.del(`/tiles/pages/${id}`);
      setPages((prev) => {
        const next = prev.filter((p) => p.id !== id);
        setActivePageId((cur) => (cur === id ? next[0]?.id ?? null : cur));
        return next;
      });
      notify('Page deleted');
    } catch {
      notify('Delete failed', true);
    }
  }, [notify]);

  const reorderPages = useCallback(async (ids: number[]) => {
    setPages((prev) => ids.map((id) => prev.find((p) => p.id === id)).filter(Boolean) as Page[]);
    await api.put('/tiles/pages/reorder', { ids }).catch(() => notify('Reorder failed', true));
  }, [notify]);

  // ---- Tiles (for the active page + globals) -----------------------------
  const loadTiles = useCallback(() => {
    if (!activePageId) return;
    const base = canEdit ? '/tiles/all' : '/tiles';
    api
      .get<{ tiles: Tile[] }>(`${base}?page=${activePageId}`)
      .then((r) => setTiles(r.tiles))
      .catch(() => setTiles([]));
  }, [canEdit, activePageId]);

  useEffect(() => {
    setTiles(null);
    loadTiles();
  }, [loadTiles]);

  // Poll service statuses.
  useEffect(() => {
    const load = () =>
      api.get<{ statuses: Record<number, ServiceStatus> }>('/tiles/status').then((r) => setStatuses(r.statuses)).catch(() => {});
    load();
    const t = window.setInterval(load, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const layouts = useMemo(() => {
    const list = tiles || [];
    // Enforce content-aware minimums so a content-heavy tile can't be shrunk
    // small enough to clip its contents, and grow tiles that start too small.
    const lg: Layout[] = list.map((t) => {
      const m = tileMins(t);
      return {
        i: String(t.id),
        x: t.x,
        y: t.y,
        w: Math.max(t.w, m.minW),
        h: Math.max(t.h, m.minH),
        minW: m.minW,
        minH: m.minH,
      };
    });
    // Mobile: stack everything into a single column, preserving reading order.
    const ordered = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
    let cursor = 0;
    const xs: Layout[] = ordered.map((t) => {
      const m = tileMins(t);
      const h = Math.max(t.h, m.minH);
      const item = { i: String(t.id), x: 0, y: cursor, w: 2, h, minW: 2, minH: m.minH };
      cursor += h;
      return item;
    });
    return { lg, xs };
  }, [tiles]);

  async function persistLayout(layout: Layout[]) {
    if (!canEdit) return;
    try {
      await api.put('/tiles/layout', {
        layout: layout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
      });
      // Keep local tiles in sync so a later add computes positions correctly.
      setTiles((prev) =>
        prev
          ? prev.map((t) => {
              const l = layout.find((x) => x.i === String(t.id));
              return l ? { ...t, x: l.x, y: l.y, w: l.w, h: l.h } : t;
            })
          : prev,
      );
    } catch {
      notify('Could not save layout', true);
    }
  }

  async function addTile(type: TileType) {
    const def = TILE_DEFAULTS[type];
    const maxBottom = (tiles || []).reduce((m, t) => Math.max(m, t.y + t.h), 0);
    try {
      const { tile } = await api.post<{ tile: Tile }>('/tiles', {
        type,
        config: def.config,
        x: 0,
        y: maxBottom,
        w: def.w,
        h: def.h,
        page_id: activePageId ?? undefined,
      });
      setTiles((prev) => (prev ? [...prev, tile] : [tile]));
      setShowPalette(false);
      setEditing(tile);
    } catch {
      notify('Could not add tile', true);
    }
  }

  async function saveTile(config: Record<string, any>, enabled: boolean, w?: number, h?: number) {
    if (!editing) return;
    try {
      const payload: { config: Record<string, any>; enabled: boolean; w?: number; h?: number } = { config, enabled };
      if (w !== undefined) payload.w = w;
      if (h !== undefined) payload.h = h;
      const { tile } = await api.put<{ tile: Tile }>(`/tiles/${editing.id}`, payload);
      setTiles((prev) => (prev ? prev.map((t) => (t.id === tile.id ? tile : t)) : prev));
      setEditing(null);
      notify('Saved');
    } catch {
      notify('Save failed', true);
    }
  }

  async function deleteTile() {
    if (!editing) return;
    const id = editing.id;
    setTiles((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
    setEditing(null);
    await api.del(`/tiles/${id}`).catch(() => notify('Delete failed', true));
  }

  const pagesCtx: PagesCtx = { pages, activePageId, setActivePage, addPage, renamePage, deletePage, reorderPages };

  if (!tiles) {
    return (
      <PagesContext.Provider value={pagesCtx}>
        <div className="center-state">
          <span className="spinner" />
        </div>
      </PagesContext.Provider>
    );
  }

  const empty = tiles.length === 0;

  return (
    <PagesContext.Provider value={pagesCtx}>
      <div className={`grid-wrap ${canEdit ? 'grid-wrap--edit' : ''}`}>
        {empty && !canEdit && (
          <div className="empty" style={{ marginTop: 140 }}>Nothing here yet.</div>
        )}

        {isMobile ? (
          <div className="stack">
            {[...tiles]
              .sort((a, b) => a.y - b.y || a.x - b.x)
              .map((tile) => {
                const bg = tile.type !== 'banner' ? (tile.config.bg_image as string | undefined) : undefined;
                const vid = isVideo(bg);
                // On mobile, small tiles pair up 2-across; wide ones span the row.
                const wide = MOBILE_WIDE.has(tile.type);
                return (
                  <div
                    key={String(tile.id)}
                    className={`stack-item ${wide ? 'stack-item--wide' : ''} ${!tile.enabled ? 'grid-item--hidden' : ''} ${bg ? 'grid-item--bg' : ''} ${tile.config.floating ? 'is-floating' : ''}`}
                    style={bg && !vid ? ({ ['--tile-bg']: `url("${bg}")` } as CSSProperties) : undefined}
                  >
                    {bg && vid && <TileMedia src={bg!} audio={!!tile.config.bg_audio} />}
                    <TileView tile={tile} status={statuses[tile.id]} />
                    {canEdit && (
                      <>
                        <div className="tile-actions">
                          <button className="btn btn--ghost btn--icon" onClick={() => setEditing(tile)} title="Edit tile">
                            <Icon name="pen" />
                          </button>
                        </div>
                        {!tile.enabled && <span className="tile-hidden-badge">Hidden</span>}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <ResponsiveGrid
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 768, xs: 0 }}
            cols={{ lg: COLS, xs: 2 }}
            rowHeight={ROW_H}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            isDraggable={canEdit}
            isResizable={canEdit}
            resizeHandles={['s', 'e', 'se']}
            draggableCancel=".tile-actions,.tile-actions *,.tabs__row,.tabs__row *,.tabs__admin,.tabs__admin *"
            compactType="vertical"
            onDragStop={(l) => persistLayout(l)}
            onResizeStop={(l) => persistLayout(l)}
          >
            {tiles.map((tile) => {
              // Banners paint their own background; every other tile type can carry
              // an optional per-tile background image or video (uploaded or via URL).
              const bg = tile.type !== 'banner' ? (tile.config.bg_image as string | undefined) : undefined;
              const vid = isVideo(bg);
              // The tabs nav must stay clickable in edit mode, so it skips the
              // drag-cover overlay (it's marked draggableCancel instead).
              const cover = canEdit && tile.type !== 'tabs';
              return (
                <div
                  key={String(tile.id)}
                  className={`grid-item ${!tile.enabled ? 'grid-item--hidden' : ''} ${bg ? 'grid-item--bg' : ''} ${tile.config.floating ? 'is-floating' : ''}`}
                  style={bg && !vid ? ({ ['--tile-bg']: `url("${bg}")` } as CSSProperties) : undefined}
                >
                  {bg && vid && <TileMedia src={bg!} audio={!!tile.config.bg_audio} />}
                  <TileView tile={tile} status={statuses[tile.id]} />
                  {canEdit && (
                    <>
                      {cover && <div className="tile-editcover" />}
                      <div className="tile-actions">
                        <button className="btn btn--ghost btn--icon" onClick={() => setEditing(tile)} title="Edit tile">
                          <Icon name="pen" />
                        </button>
                      </div>
                      {!tile.enabled && <span className="tile-hidden-badge">Hidden</span>}
                      <span className="tile-drag-hint"><Icon name="up-down-left-right" /></span>
                    </>
                  )}
                </div>
              );
            })}
          </ResponsiveGrid>
        )}

        {canEdit && (
          <div className="palette-fab">
            {showPalette && (
              <div className="palette">
                <p className="palette__title">Add a tile</p>
                {PALETTE.map((type) => (
                  <button key={type} className="palette__item" onClick={() => addTile(type)}>
                    <Icon name={TILE_DEFAULTS[type].icon} fixedWidth /> {TILE_DEFAULTS[type].label}
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn--primary palette__toggle" onClick={() => setShowPalette((s) => !s)}>
              <Icon name={showPalette ? 'xmark' : 'plus'} /> {showPalette ? 'Close' : 'Add tile'}
            </button>
          </div>
        )}

        {editing && (
          <TileEditor tile={editing} onSave={saveTile} onDelete={deleteTile} onClose={() => setEditing(null)} />
        )}
      </div>
    </PagesContext.Provider>
  );
}

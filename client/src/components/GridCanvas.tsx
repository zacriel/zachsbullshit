import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';
import { TileView } from '../tiles/TileView';
import { TileEditor } from '../tiles/TileEditor';
import { TileMedia, isVideo } from '../tiles/media';
import { PALETTE, TILE_DEFAULTS } from '../tiles/defaults';
import type { ServiceStatus, Tile, TileType } from '../types';

const ResponsiveGrid = WidthProvider(Responsive);
const COLS = 12;
const ROW_H = 92;

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
    default:
      return { minW: 1, minH: 1 };
  }
}

/**
 * The dashboard: a responsive, drag-and-resize grid of tiles. Visitors see
 * the saved layout (static); the admin in edit mode can drag, resize, add,
 * edit, and remove tiles, with the layout saved back to the server.
 */
export function GridCanvas() {
  const { authed, editMode, notify } = useAuth();
  const canEdit = !!authed && editMode;

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

  const loadTiles = useCallback(() => {
    api
      .get<{ tiles: Tile[] }>(canEdit ? '/tiles/all' : '/tiles')
      .then((r) => setTiles(r.tiles))
      .catch(() => setTiles([]));
  }, [canEdit]);

  useEffect(() => {
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

  if (!tiles) {
    return (
      <div className="center-state">
        <span className="spinner" />
      </div>
    );
  }

  const empty = tiles.length === 0;

  return (
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
              return (
                <div
                  key={String(tile.id)}
                  className={`stack-item ${!tile.enabled ? 'grid-item--hidden' : ''} ${bg ? 'grid-item--bg' : ''}`}
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
          isDraggable={canEdit}
          isResizable={canEdit}
          resizeHandles={['s', 'e', 'se']}
          draggableCancel=".tile-actions,.tile-actions *"
          compactType="vertical"
          onDragStop={(l) => persistLayout(l)}
          onResizeStop={(l) => persistLayout(l)}
        >
          {tiles.map((tile) => {
            // Banners paint their own background; every other tile type can carry
            // an optional per-tile background image or video (uploaded or via URL).
            const bg = tile.type !== 'banner' ? (tile.config.bg_image as string | undefined) : undefined;
            const vid = isVideo(bg);
            return (
              <div
                key={String(tile.id)}
                className={`grid-item ${!tile.enabled ? 'grid-item--hidden' : ''} ${bg ? 'grid-item--bg' : ''}`}
                style={bg && !vid ? ({ ['--tile-bg']: `url("${bg}")` } as CSSProperties) : undefined}
              >
                {bg && vid && <TileMedia src={bg!} audio={!!tile.config.bg_audio} />}
                <TileView tile={tile} status={statuses[tile.id]} />
                {canEdit && (
                  <>
                    <div className="tile-editcover" />
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
  );
}

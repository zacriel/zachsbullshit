import { createContext, useContext } from 'react';
import type { Page } from '../types';

/**
 * Shared page-navigation state. GridCanvas owns the pages list and which one
 * is active; the tabs tile (and anything else) reads and drives it from here.
 * Admin actions are provided so the tabs tile can manage pages inline.
 */
export interface PagesCtx {
  pages: Page[];
  activePageId: number | null;
  setActivePage: (id: number) => void;
  // Admin-only; no-ops for visitors.
  addPage: (name: string) => Promise<void>;
  renamePage: (id: number, name: string) => Promise<void>;
  deletePage: (id: number) => Promise<void>;
  reorderPages: (ids: number[]) => Promise<void>;
}

const noop = async () => {};

export const PagesContext = createContext<PagesCtx>({
  pages: [],
  activePageId: null,
  setActivePage: () => {},
  addPage: noop,
  renamePage: noop,
  deletePage: noop,
  reorderPages: noop,
});

export const usePages = () => useContext(PagesContext);

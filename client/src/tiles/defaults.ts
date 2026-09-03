import type { TileType } from '../types';

/** Default config + grid size for each tile type, used when adding a new tile. */
export const TILE_DEFAULTS: Record<
  TileType,
  { label: string; icon: string; config: Record<string, any>; w: number; h: number }
> = {
  banner: {
    label: 'Banner',
    icon: 'image',
    config: { title: 'New banner', subtitle: '', image_url: '', align: 'center' },
    w: 12,
    h: 4,
  },
  heading: {
    label: 'Category / heading',
    icon: 'heading',
    config: { text: 'Category', level: 2, icon: '' },
    w: 12,
    h: 1,
  },
  link: {
    label: 'Link',
    icon: 'link',
    config: { label: 'New link', url: 'https://example.com', icon: 'link', description: '' },
    w: 3,
    h: 2,
  },
  service: {
    label: 'Service / Minecraft',
    icon: 'heart-pulse',
    config: { name: 'New service', kind: 'web', url: 'https://example.com', host: '', icon: 'server' },
    w: 4,
    h: 3,
  },
  project: {
    label: 'Project',
    icon: 'diagram-project',
    config: { title: 'New project', description: '', url: '', repo_url: '', tags: [], icon: 'cube', image_url: '' },
    w: 4,
    h: 4,
  },
  text: {
    label: 'Text / Note',
    icon: 'align-left',
    config: { body: 'Some text…', align: 'left' },
    w: 4,
    h: 3,
  },
  contact: {
    label: 'Contact form',
    icon: 'envelope',
    config: { title: 'Get in touch', subtitle: '' },
    w: 6,
    h: 6,
  },
  icons: {
    label: 'Icon row',
    icon: 'icons',
    config: { items: [{ icon: 'github', url: 'https://github.com', label: 'GitHub' }], size: 'md', align: 'center' },
    w: 4,
    h: 2,
  },
  download: {
    label: 'Download',
    icon: 'download',
    config: { title: 'Download', description: '', icon: 'download', file: '', filename: '', size: 0, protected: false, external_url: '' },
    w: 3,
    h: 3,
  },
  embed: {
    label: 'Embed / iframe',
    icon: 'window-maximize',
    config: { url: '', title: '' },
    w: 6,
    h: 5,
  },
  command: {
    label: 'Quick-copy',
    icon: 'terminal',
    config: { label: 'Command', command: 'echo hello', icon: 'terminal' },
    w: 4,
    h: 2,
  },
  clock: {
    label: 'Clock / countdown',
    icon: 'clock',
    config: { mode: 'clock', timezone: '', label: '', showSeconds: true, target: '' },
    w: 3,
    h: 2,
  },
  weather: {
    label: 'Weather',
    icon: 'cloud-sun',
    config: { place: '', lat: null, lon: null, units: 'c', label: '' },
    w: 3,
    h: 3,
  },
  rss: {
    label: 'RSS feed',
    icon: 'rss',
    config: { url: '', label: 'Feed', count: 6 },
    w: 4,
    h: 5,
  },
};

export const PALETTE: TileType[] = [
  'banner', 'heading', 'link', 'icons', 'service', 'project',
  'text', 'contact', 'download', 'embed', 'command', 'clock', 'weather', 'rss',
];

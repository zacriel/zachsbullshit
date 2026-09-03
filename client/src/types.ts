export interface ModuleManifestEntry {
  id: string;
  name: string;
  icon: string;
  public: boolean;
}

export type TileType =
  | 'link'
  | 'banner'
  | 'service'
  | 'project'
  | 'text'
  | 'heading'
  | 'contact'
  | 'icons'
  | 'download'
  | 'embed'
  | 'command'
  | 'clock'
  | 'weather'
  | 'rss';

export interface Tile {
  id: number;
  type: TileType;
  // Free-form, type-specific configuration (label/url/icon, host/kind, etc.).
  config: Record<string, any>;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
}

export interface ServiceStatus {
  status: 'up' | 'degraded' | 'down' | null;
  code: number | null;
  latency_ms: number | null;
  players_online: number | null;
  players_max: number | null;
  motd: string | null;
  version: string | null;
  checked_at: string | null;
}

export interface LinkItem {
  id: number;
  label: string;
  url: string;
  icon: string;
  description: string | null;
  category: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface ProjectItem {
  id: number;
  title: string;
  description: string | null;
  url: string | null;
  repo_url: string | null;
  tags: string[];
  icon: string;
  image_url: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface SocialLink {
  label: string;
  url: string;
  icon: string;
}

export interface AboutData {
  id: number;
  name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  socials: SocialLink[];
  skills: string[];
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ServiceItem {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  sort_order: number;
  last_status: 'up' | 'degraded' | 'down' | null;
  last_code: number | null;
  last_latency_ms: number | null;
  last_checked: string | null;
}

export interface AnalyticsSummary {
  total: number;
  perLink: { link_id: number; count: number }[];
  daily: { day: string; count: number }[];
}

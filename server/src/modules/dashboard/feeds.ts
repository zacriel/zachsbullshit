import { XMLParser } from 'fast-xml-parser';

/**
 * Minimal RSS/Atom feed fetcher with a short in-memory cache. Returns a
 * normalized list of items. Server-side only (feed URLs come from an
 * admin-configured tile, never an arbitrary request parameter).
 */

export interface FeedItem {
  title: string;
  link: string;
  date: string | null;
}

interface CacheEntry {
  at: number;
  items: FeedItem[];
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)['#text']);
  return String(v);
}

/** Atom links can be an array of objects; pick the alternate/href. */
function atomLink(link: unknown): string {
  if (typeof link === 'string') return link;
  if (Array.isArray(link)) {
    const alt = link.find((l) => (l as Record<string, unknown>)['@_rel'] === 'alternate') || link[0];
    return String((alt as Record<string, unknown>)?.['@_href'] || '');
  }
  if (link && typeof link === 'object') return String((link as Record<string, unknown>)['@_href'] || '');
  return '';
}

export async function fetchFeed(url: string, count = 6): Promise<FeedItem[]> {
  const cached = CACHE.get(url);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.items.slice(0, count);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let xml: string;
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'zachsbullshit-hub/1.0' } });
    xml = await resp.text();
  } finally {
    clearTimeout(timer);
  }

  const doc = parser.parse(xml);
  let items: FeedItem[] = [];

  if (doc?.rss?.channel) {
    const raw = doc.rss.channel.item;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    items = list.map((it: Record<string, unknown>) => ({
      title: text(it.title),
      link: text(it.link),
      date: (it.pubDate ? String(it.pubDate) : null),
    }));
  } else if (doc?.feed) {
    const raw = doc.feed.entry;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    items = list.map((it: Record<string, unknown>) => ({
      title: text(it.title),
      link: atomLink(it.link),
      date: (it.updated ? String(it.updated) : it.published ? String(it.published) : null),
    }));
  }

  CACHE.set(url, { at: Date.now(), items });
  return items.slice(0, count);
}

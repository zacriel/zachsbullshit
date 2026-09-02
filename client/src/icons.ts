/**
 * FontAwesome is the ONLY icon source in this app. We register the free
 * solid and brand packs once, then resolve icons by their string name
 * (as stored in the database) at render time.
 */
import { library, findIconDefinition, type IconLookup, type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';

library.add(fas, fab);

const FALLBACK: IconLookup = { prefix: 'fas', iconName: 'circle-dot' };

/**
 * Resolve a stored icon name to a FontAwesome definition. Brand names
 * (github, linkedin, x-twitter…) resolve to the brand pack; everything
 * else to solid. Unknown names fall back to a neutral dot.
 */
export function resolveIcon(name: string | null | undefined): IconDefinition {
  const clean = (name || '').trim().replace(/^fa[-\s]?/, '');
  if (!clean) return findIconDefinition(FALLBACK) as IconDefinition;

  const brand = findIconDefinition({ prefix: 'fab', iconName: clean as IconLookup['iconName'] });
  if (brand) return brand;

  const solid = findIconDefinition({ prefix: 'fas', iconName: clean as IconLookup['iconName'] });
  if (solid) return solid;

  return findIconDefinition(FALLBACK) as IconDefinition;
}

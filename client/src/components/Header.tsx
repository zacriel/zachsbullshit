import { Icon } from './Icon';
import type { ModuleManifestEntry } from '../types';

/** Sticky header with brand mark and anchor nav for enabled public modules. */
export function Header({ brand, modules }: { brand: string; modules: ModuleManifestEntry[] }) {
  const navItems = modules.filter((m) => ['links', 'projects', 'about', 'contact'].includes(m.id));

  return (
    <header className="header">
      <div className="container header__inner">
        <a className="brand" href="/">
          <span className="brand__mark">
            <Icon name="bolt" />
          </span>
          {brand}
        </a>
        <nav className="nav">
          {navItems.map((m) => (
            <a key={m.id} href={`#${m.id}`}>
              {m.name}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

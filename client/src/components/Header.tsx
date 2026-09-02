import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../auth/AuthContext';
import type { ModuleManifestEntry } from '../types';

/**
 * Floating header. At the top of the page it sits flush and transparent;
 * once scrolled it condenses into a glass pill. It hides when scrolling
 * down and reveals when scrolling up.
 */
export function Header({
  brand,
  modules,
  onSignIn,
}: {
  brand: string;
  modules: ModuleManifestEntry[];
  onSignIn: () => void;
}) {
  const { authed, editMode, setEditMode, logout } = useAuth();
  const [floating, setFloating] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setFloating(y > 40);
      // Hide on downward scroll past the hero; always show near the top.
      if (y > lastY.current && y > 300) setHidden(true);
      else setHidden(false);
      lastY.current = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = modules.filter((m) => ['links', 'projects', 'about', 'contact'].includes(m.id));

  return (
    <header
      className={`header ${floating ? 'header--floating' : ''} ${hidden && !editMode ? 'header--hidden' : ''}`}
    >
      <div className="container header__bar">
        <a className="brand" href="#top">
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

        <div className="header__actions">
          {authed ? (
            <>
              <button
                className={`btn btn--ghost btn--sm ${editMode ? 'edit-toggle--on' : ''}`}
                onClick={() => setEditMode(!editMode)}
                title={editMode ? 'Exit edit mode' : 'Edit this page'}
              >
                <Icon name={editMode ? 'check' : 'pen-to-square'} /> {editMode ? 'Done' : 'Edit'}
              </button>
              <a className="btn btn--ghost btn--icon" href="/admin" title="Dashboard (messages, health, analytics)">
                <Icon name="gauge-high" />
              </a>
              <button className="btn btn--ghost btn--icon" onClick={logout} title="Sign out">
                <Icon name="right-from-bracket" />
              </button>
            </>
          ) : (
            <button className="btn btn--ghost btn--sm" onClick={onSignIn} title="Admin sign in">
              <Icon name="lock" /> Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

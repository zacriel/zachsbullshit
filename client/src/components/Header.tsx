import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../auth/AuthContext';

/**
 * Floating header. Flush and transparent at the top; once scrolled it
 * condenses into a glass pill, hides on scroll-down and reappears on
 * scroll-up. Admin controls appear when signed in; signing in itself lives
 * in the footer, so the public header stays clean.
 */
export function Header({ brand }: { brand: string }) {
  const { authed, editMode, setEditMode, logout } = useAuth();
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    // The header stays visible at all times; it only condenses into the
    // floating pill once the page is scrolled a little.
    function onScroll() {
      setFloating(window.scrollY > 40);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`header ${floating ? 'header--floating' : ''}`}>
      <div className="container header__bar">
        <a className="brand" href="#top" aria-label={brand}>
          <img className="brand__logo" src="/logo.png" alt={brand} />
        </a>

        {authed && (
          <div className="header__actions">
            <button
              className={`btn btn--ghost btn--sm ${editMode ? 'edit-toggle--on' : ''}`}
              onClick={() => setEditMode(!editMode)}
              title={editMode ? 'Exit edit mode' : 'Edit dashboard'}
            >
              <Icon name={editMode ? 'check' : 'pen-to-square'} /> {editMode ? 'Done' : 'Edit'}
            </button>
            <a className="btn btn--ghost btn--icon" href="/admin" title="Dashboard (messages, analytics)">
              <Icon name="gauge-high" />
            </a>
            <button className="btn btn--ghost btn--icon" onClick={logout} title="Sign out">
              <Icon name="right-from-bracket" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

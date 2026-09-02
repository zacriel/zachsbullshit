import { Icon } from './Icon';
import { useAuth } from '../auth/AuthContext';

/**
 * App footer. Carries the single, discreet admin entry point: a sign-in
 * prompt when signed out, or a link to the dashboard when signed in.
 */
export function Footer({ brand, onSignIn }: { brand: string; onSignIn: () => void }) {
  const { authed } = useAuth();
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>
          © {year} {brand}
        </span>
        {authed ? (
          <a href="/admin" title="Dashboard">
            <Icon name="gauge-high" /> Dashboard
          </a>
        ) : (
          <button className="footer__admin" onClick={onSignIn} title="Admin sign in">
            <Icon name="lock" /> Admin
          </button>
        )}
      </div>
    </footer>
  );
}

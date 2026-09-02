import { Icon } from './Icon';

/** App footer with a discreet admin entry point. */
export function Footer({ brand }: { brand: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>
          © {year} {brand}
        </span>
        <a href="/admin" title="Admin">
          <Icon name="lock" /> Admin
        </a>
      </div>
    </footer>
  );
}

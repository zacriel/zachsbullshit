import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { AppearanceProvider } from './appearance/AppearanceContext';
import './icons'; // registers the FontAwesome library once
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './theme.css';

/**
 * Smooth full-page navigations (site <-> admin) with a quick fade-out.
 * Intercepts left-clicks on internal path links, fades the view, then
 * navigates. Hash links, new-tab, downloads, modified clicks, cross-origin
 * links, and reduced-motion users are left to the browser's default.
 */
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (
      !href ||
      !href.startsWith('/') ||
      link.target === '_blank' ||
      link.hasAttribute('download') ||
      link.origin !== window.location.origin ||
      link.pathname === window.location.pathname
    )
      return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    window.setTimeout(() => {
      window.location.href = href;
    }, 240);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppearanceProvider>
        <App />
      </AppearanceProvider>
    </AuthProvider>
  </StrictMode>,
);

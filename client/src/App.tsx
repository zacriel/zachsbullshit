import { useEffect, useState } from 'react';
import { api } from './api';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Icon } from './components/Icon';
import { AboutModule } from './modules/AboutModule';
import { LinksModule } from './modules/LinksModule';
import { ProjectsModule } from './modules/ProjectsModule';
import { ContactModule } from './modules/ContactModule';
import { AdminApp } from './admin/AdminApp';
import type { ModuleManifestEntry } from './types';

const BRAND = 'Zac Stambaugh';

/** Public modules render in this order; anything not in the manifest is skipped. */
const PUBLIC_ORDER = ['about', 'links', 'projects', 'contact'] as const;

const COMPONENTS: Record<string, (props: { icon: string }) => JSX.Element | null> = {
  about: AboutModule,
  links: LinksModule,
  projects: ProjectsModule,
  contact: ContactModule,
};

export default function App() {
  // Simple path routing — server serves index.html for every route.
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminApp />;
  }
  return <PublicSite />;
}

function PublicSite() {
  const [modules, setModules] = useState<ModuleManifestEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<{ modules: ModuleManifestEntry[] }>('/modules')
      .then((r) => setModules(r.modules))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="center-state">
        <Icon name="triangle-exclamation" />
        <p>Could not reach the server. Please try again shortly.</p>
      </div>
    );
  }

  if (!modules) {
    return (
      <div className="center-state">
        <span className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  const publicModules = modules.filter((m) => m.public);
  const byId = new Map(publicModules.map((m) => [m.id, m]));
  const hasAbout = byId.has('about');

  return (
    <div className="app">
      <Header brand={BRAND} modules={publicModules} />
      <main className="main">
        <div className="container">
          {/* Fallback hero when the About module is disabled */}
          {!hasAbout && (
            <header className="hero">
              <div className="hero__avatar hero__avatar--fallback">
                <Icon name="bolt" />
              </div>
              <h1>{BRAND}</h1>
              <p className="hero__headline">Everything I build, in one place.</p>
            </header>
          )}

          {PUBLIC_ORDER.map((id) => {
            const mod = byId.get(id);
            if (!mod) return null;
            const Comp = COMPONENTS[id];
            return Comp ? <Comp key={id} icon={mod.icon} /> : null;
          })}

          {publicModules.length === 0 && (
            <div className="empty" style={{ marginTop: 48 }}>
              No public modules are enabled.
            </div>
          )}
        </div>
      </main>
      <Footer brand={BRAND} />
    </div>
  );
}

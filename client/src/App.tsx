import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Icon } from './components/Icon';
import { LoginModal } from './components/LoginModal';
import { AboutModule } from './modules/AboutModule';
import { LinksModule } from './modules/LinksModule';
import { ProjectsModule } from './modules/ProjectsModule';
import { ContactModule } from './modules/ContactModule';
import { AdminApp } from './admin/AdminApp';
import type { ModuleManifestEntry } from './types';

const BRAND = 'Zac Stambaugh';
const PUBLIC_ORDER = ['about', 'links', 'projects', 'contact'] as const;

const COMPONENTS: Record<string, (props: { icon: string }) => JSX.Element | null> = {
  about: AboutModule,
  links: LinksModule,
  projects: ProjectsModule,
  contact: ContactModule,
};

export default function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminApp />;
  }
  return <PublicSite />;
}

function GradientGround() {
  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <div className="gradient-veil" aria-hidden="true" />
    </>
  );
}

function PublicSite() {
  const { editMode, toast, setEditMode } = useAuth();
  const [modules, setModules] = useState<ModuleManifestEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    api
      .get<{ modules: ModuleManifestEntry[] }>('/modules')
      .then((r) => setModules(r.modules))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <>
        <GradientGround />
        <div className="center-state">
          <Icon name="triangle-exclamation" />
          <p>Could not reach the server. Please try again shortly.</p>
        </div>
      </>
    );
  }

  if (!modules) {
    return (
      <>
        <GradientGround />
        <div className="center-state">
          <span className="spinner" />
          <p>Loading…</p>
        </div>
      </>
    );
  }

  const publicModules = modules.filter((m) => m.public);
  const byId = new Map(publicModules.map((m) => [m.id, m]));
  const hasAbout = byId.has('about');

  return (
    <>
      <GradientGround />
      <div className="app">
        <Header brand={BRAND} modules={publicModules} onSignIn={() => setShowLogin(true)} />

        <main className="main">
          {!hasAbout && (
            <section className="jumbo" id="top">
              <div className="jumbo__avatar jumbo__avatar--fallback">
                <Icon name="bolt" />
              </div>
              <h1>{BRAND}</h1>
              <p className="jumbo__headline">Everything I build, in one place.</p>
            </section>
          )}

          <div className="container">
            {PUBLIC_ORDER.map((id) => {
              const mod = byId.get(id);
              if (!mod) return null;
              const Comp = COMPONENTS[id];
              return Comp ? <Comp key={id} icon={mod.icon} /> : null;
            })}

            {publicModules.length === 0 && (
              <div className="empty" style={{ marginTop: 120 }}>
                No public modules are enabled.
              </div>
            )}
          </div>

          <Footer brand={BRAND} />
        </main>
      </div>

      {editMode && (
        <div className="edit-banner">
          <span className="edit-banner__dot" />
          <span>Editing — changes save as you go</span>
          <button className="btn btn--primary btn--sm" onClick={() => setEditMode(false)}>
            <Icon name="check" /> Done
          </button>
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {toast && (
        <div className={`toast ${toast.err ? 'toast--error' : ''}`}>
          <Icon name={toast.err ? 'circle-exclamation' : 'circle-check'} className="toast__ico" />
          {toast.msg}
        </div>
      )}
    </>
  );
}

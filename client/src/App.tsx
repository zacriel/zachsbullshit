import { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Icon } from './components/Icon';
import { LoginModal } from './components/LoginModal';
import { GridCanvas } from './components/GridCanvas';
import { AdminApp } from './admin/AdminApp';

const BRAND = 'zachsbullshit';

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
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <GradientGround />
      <div className="app">
        <Header brand={BRAND} />

        <main className="main main--grid">
          <div className="container">
            <GridCanvas />
          </div>
          <Footer brand={BRAND} onSignIn={() => setShowLogin(true)} />
        </main>
      </div>

      {editMode && (
        <div className="edit-banner">
          <span className="edit-banner__dot" />
          <span>Editing — drag, resize, add &amp; edit tiles</span>
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

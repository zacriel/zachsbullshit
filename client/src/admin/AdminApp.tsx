import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api';
import { Icon } from '../components/Icon';
import { Login } from './Login';
import { ContactAdmin } from './ContactAdmin';
import { HealthAdmin } from './HealthAdmin';
import { AnalyticsAdmin } from './AnalyticsAdmin';
import { SystemAdmin } from './SystemAdmin';
import { FilesAdmin } from './FilesAdmin';
import { GoLinksAdmin } from './GoLinksAdmin';
import type { ModuleManifestEntry } from '../types';

type NotifyFn = (message: string, isError?: boolean) => void;

interface TabDef {
  id: string;
  label: string;
  icon: string;
  render: (notify: NotifyFn) => JSX.Element;
}

// Content (links / projects / about) is edited inline on the site itself.
// The dashboard keeps only the backend-facing modules. A tab shows only if
// its module is enabled.
const TAB_DEFS: TabDef[] = [
  { id: 'contact', label: 'Messages', icon: 'envelope', render: (n) => <ContactAdmin notify={n} /> },
  { id: 'health', label: 'Health', icon: 'heart-pulse', render: (n) => <HealthAdmin notify={n} /> },
  { id: 'analytics', label: 'Analytics', icon: 'chart-line', render: () => <AnalyticsAdmin /> },
];

// Always available (not tied to a toggleable module).
const ALWAYS_TABS: TabDef[] = [
  { id: 'golinks', label: 'Go links', icon: 'link', render: (n) => <GoLinksAdmin notify={n} /> },
  { id: 'files', label: 'Files', icon: 'folder-open', render: (n) => <FilesAdmin notify={n} /> },
  { id: 'system', label: 'System', icon: 'server', render: (n) => <SystemAdmin notify={n} /> },
];

export function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [modules, setModules] = useState<ModuleManifestEntry[]>([]);
  const [active, setActive] = useState<string>('links');
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const [unread, setUnread] = useState(0);

  const notify: NotifyFn = useCallback((msg, err = false) => {
    setToast({ msg, err });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Verify token, then load the module manifest.
  useEffect(() => {
    if (!getToken()) {
      setAuthed(false);
      return;
    }
    api
      .get('/auth/me')
      .then(() => setAuthed(true))
      .catch(() => {
        setToken(null);
        setAuthed(false);
      });
  }, []);

  useEffect(() => {
    if (!authed) return;
    api.get<{ modules: ModuleManifestEntry[] }>('/modules').then((r) => {
      setModules(r.modules);
      const first = TAB_DEFS.find((t) => r.modules.some((m) => m.id === t.id));
      if (first) setActive(first.id);
    });
    // Unread messages badge (only if contact enabled).
    api.get<{ unread: number }>('/contact').then((r) => setUnread(r.unread)).catch(() => {});
  }, [authed]);

  function logout() {
    api.post('/auth/logout').catch(() => {});
    setToken(null);
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="center-state">
        <span className="spinner" />
      </div>
    );
  }
  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;

  const tabs = [...TAB_DEFS.filter((t) => modules.some((m) => m.id === t.id)), ...ALWAYS_TABS];
  const current = tabs.find((t) => t.id === active) || tabs[0];

  return (
    <div className="admin-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="brand__mark">
            <Icon name="gauge-high" />
          </span>
          Admin
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn--ghost" href="/">
            <Icon name="arrow-up-right-from-square" /> View site
          </a>
          <button className="btn btn--ghost" onClick={logout}>
            <Icon name="right-from-bracket" /> Sign out
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`admin-tab ${t.id === active ? 'admin-tab--active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            <Icon name={t.icon} /> {t.label}
            {t.id === 'contact' && unread > 0 && <span className="badge-unread">{unread}</span>}
          </button>
        ))}
      </div>

      {current ? current.render(notify) : <div className="empty">No admin modules enabled.</div>}

      {toast && <div className={`toast ${toast.err ? 'toast--error' : ''}`}>{toast.msg}</div>}
    </div>
  );
}

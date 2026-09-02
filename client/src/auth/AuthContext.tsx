import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../api';

interface AuthUser {
  sub: number;
  username: string;
}

interface AuthState {
  /** null = still checking, false = anonymous, true = signed in */
  authed: boolean | null;
  user: AuthUser | null;
  /** Inline edit mode (only meaningful when authed). */
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  /** Transient toast. */
  notify: (message: string, isError?: boolean) => void;
  toast: { msg: string; err: boolean } | null;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [editMode, setEditModeState] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);

  const notify = useCallback((message: string, isError = false) => {
    setToast({ msg: message, err: isError });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Verify any stored token once on mount.
  useEffect(() => {
    if (!getToken()) {
      setAuthed(false);
      return;
    }
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then((r) => {
        setUser(r.user);
        setAuthed(true);
      })
      .catch(() => {
        setToken(null);
        setAuthed(false);
      });
  }, []);

  const login = useCallback((token: string, u: AuthUser) => {
    setToken(token);
    setUser(u);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
    setAuthed(false);
    setEditModeState(false);
  }, []);

  const setEditMode = useCallback((v: boolean) => {
    setEditModeState(v);
    // Reflect on <body> so global styles (dashed affordances) can key off it.
    document.body.classList.toggle('editing', v);
  }, []);

  return (
    <Ctx.Provider
      value={{ authed, user, editMode, setEditMode, login, logout, notify, toast }}
    >
      {children}
    </Ctx.Provider>
  );
}

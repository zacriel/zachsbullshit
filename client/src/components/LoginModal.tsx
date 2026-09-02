import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';

/** Sign-in modal — lets the admin authenticate without leaving the page. */
export function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, setEditMode, notify } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.post<{ token: string; user: { sub?: number; id?: number; username: string } }>(
        '/auth/login',
        { username, password },
      );
      login(token, { sub: user.sub ?? user.id ?? 0, username: user.username });
      setEditMode(true);
      notify('Signed in — edit mode on');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className="brand__mark" style={{ margin: '0 auto 14px' }}>
            <Icon name="lock" />
          </span>
          <h2 style={{ fontSize: '1.35rem' }}>Admin sign in</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 6 }}>
            Sign in to edit this page in place.
          </p>
        </div>
        <div className="field">
          <label htmlFor="lm-u">Username</label>
          <input id="lm-u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="lm-p">Password</label>
          <input id="lm-p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p style={{ color: 'var(--down)', fontSize: '0.88rem', margin: '0 0 12px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" style={{ flex: 1 }} disabled={busy}>
            {busy ? <Icon name="spinner" spin /> : <Icon name="right-to-bracket" />} Sign in
          </button>
        </div>
      </form>
    </div>
  );
}

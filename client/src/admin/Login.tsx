import { useState, type FormEvent } from 'react';
import { api, setToken, ApiError } from '../api';
import { Icon } from '../components/Icon';

/** Admin login card. On success, stores the JWT and calls onAuthed(). */
export function Login({ onAuthed }: { onAuthed: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.post<{ token: string }>('/auth/login', { username, password });
      setToken(token);
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className="brand__mark" style={{ margin: '0 auto 12px' }}>
            <Icon name="lock" />
          </span>
          <h2 style={{ fontSize: '1.3rem' }}>Admin sign in</h2>
        </div>
        <div className="field">
          <label htmlFor="u">Username</label>
          <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p style={{ color: 'var(--down)', fontSize: '0.88rem' }}>{error}</p>}
        <button className="btn btn--primary" style={{ width: '100%', marginTop: 8 }} disabled={busy}>
          {busy ? <Icon name="spinner" spin /> : <Icon name="right-to-bracket" />} Sign in
        </button>
        <p style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="/">← Back to site</a>
        </p>
      </form>
    </div>
  );
}

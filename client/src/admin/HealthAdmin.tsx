import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import type { ServiceItem } from '../types';

const STATUS_LABEL: Record<string, string> = { up: 'Up', degraded: 'Degraded', down: 'Down' };

export function HealthAdmin({ notify }: { notify: (m: string, err?: boolean) => void }) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);

  const load = () =>
    api.get<{ services: ServiceItem[] }>('/health/services').then((r) => setServices(r.services)).catch(() => {});

  useEffect(() => {
    void load();
  }, []);

  async function add() {
    if (!name || !url) {
      notify('Name and URL required', true);
      return;
    }
    await api.post('/health/services', { name, url }).catch(() => notify('Add failed', true));
    setName('');
    setUrl('');
    await load();
  }

  async function remove(id: number) {
    if (!confirm('Remove this service?')) return;
    await api.del(`/health/services/${id}`).catch(() => {});
    await load();
  }

  async function checkNow() {
    setChecking(true);
    try {
      const r = await api.post<{ services: ServiceItem[] }>('/health/check');
      setServices(r.services);
    } catch {
      notify('Check failed', true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div className="admin-row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
          <label>Service name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0, flex: '2 1 240px' }}>
          <label>Health URL</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <button className="btn btn--primary" onClick={add}>
          <Icon name="plus" /> Add
        </button>
        <button className="btn btn--ghost" onClick={checkNow} disabled={checking}>
          <Icon name="rotate" spin={checking} /> Check now
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {services.map((s) => {
          const status = s.last_status || 'down';
          return (
            <div key={s.id} className="admin-row">
              <span className={`pill pill--${status}`}>
                <span className="pill__dot" /> {STATUS_LABEL[status] || 'Unknown'}
              </span>
              <div className="admin-row__grow">
                <strong>{s.name}</strong>
                <div className="admin-row__muted">{s.url}</div>
              </div>
              <span className="admin-row__muted">
                {s.last_latency_ms != null ? `${s.last_latency_ms} ms` : '—'}
                {s.last_code ? ` · ${s.last_code}` : ''}
              </span>
              <button className="btn btn--danger" onClick={() => remove(s.id)}>
                <Icon name="trash" />
              </button>
            </div>
          );
        })}
        {services.length === 0 && <div className="empty">No services monitored yet.</div>}
      </div>
    </div>
  );
}

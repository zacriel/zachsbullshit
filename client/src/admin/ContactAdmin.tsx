import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import type { ContactMessage } from '../types';

export function ContactAdmin({ notify }: { notify: (m: string, err?: boolean) => void }) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  const load = () =>
    api.get<{ messages: ContactMessage[] }>('/contact').then((r) => setMessages(r.messages)).catch(() => {});

  useEffect(() => {
    void load();
  }, []);

  async function markRead(id: number) {
    await api.patch(`/contact/${id}/read`).catch(() => {});
    await load();
  }

  async function remove(id: number) {
    if (!confirm('Delete this message?')) return;
    await api.del(`/contact/${id}`).catch(() => notify('Delete failed', true));
    await load();
  }

  return (
    <div>
      {messages.length === 0 && <div className="empty">No messages yet.</div>}
      {messages.map((m) => (
        <div key={m.id} className="admin-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}>
            <strong>{m.name}</strong>
            <a href={`mailto:${m.email}`}>{m.email}</a>
            {!m.read && <span className="badge-unread">NEW</span>}
            <span className="admin-row__muted" style={{ marginLeft: 'auto' }}>
              {new Date(m.created_at + 'Z').toLocaleString()}
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{m.message}</p>
          <div className="admin-actions">
            {!m.read && (
              <button className="btn btn--ghost" onClick={() => markRead(m.id)}>
                <Icon name="check" /> Mark read
              </button>
            )}
            <button className="btn btn--danger" onClick={() => remove(m.id)}>
              <Icon name="trash" /> Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

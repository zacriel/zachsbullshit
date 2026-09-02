import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import type { AnalyticsSummary, LinkItem } from '../types';

export function AnalyticsAdmin() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [labels, setLabels] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<{ summary: AnalyticsSummary }>('/analytics/summary')
      // support either {summary} or flat shape
      .then((r) => setSummary((r as unknown as AnalyticsSummary).total !== undefined ? (r as unknown as AnalyticsSummary) : r.summary))
      .catch(() => {});
    // Link labels are best-effort — analytics works even if links is off.
    api.get<{ links: LinkItem[] }>('/links/all')
      .then((r) => setLabels(Object.fromEntries(r.links.map((l) => [l.id, l.label]))))
      .catch(() => {});
  }, []);

  if (!summary) return <div className="empty">No analytics data.</div>;

  const maxDaily = Math.max(1, ...summary.daily.map((d) => d.count));

  return (
    <div>
      <div className="admin-row" style={{ gap: 24 }}>
        <div>
          <div className="admin-row__muted">Total clicks</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-bright)' }}>{summary.total}</div>
        </div>
        <div>
          <div className="admin-row__muted">Links tracked</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{summary.perLink.length}</div>
        </div>
      </div>

      <h3 style={{ margin: '24px 0 12px', fontSize: '1rem' }}>
        <Icon name="chart-simple" /> Last 14 days
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
        {summary.daily.length === 0 && <div className="admin-row__muted">No clicks yet.</div>}
        {summary.daily.map((d) => (
          <div key={d.day} title={`${d.day}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: '100%',
                height: `${(d.count / maxDaily) * 100}%`,
                minHeight: 3,
                background: 'linear-gradient(180deg, var(--accent-bright), var(--accent-deep))',
                borderRadius: 4,
              }}
            />
            <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)' }}>{d.day.slice(5)}</span>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '24px 0 12px', fontSize: '1rem' }}>
        <Icon name="ranking-star" /> Top links
      </h3>
      {summary.perLink.map((row) => (
        <div key={row.link_id} className="admin-row">
          <div className="admin-row__grow">
            <strong>{labels[row.link_id] || `Link #${row.link_id}`}</strong>
          </div>
          <span className="tag">{row.count} clicks</span>
        </div>
      ))}
      {summary.perLink.length === 0 && <div className="empty">No clicks recorded yet.</div>}
    </div>
  );
}

"use client";
import { useState, useEffect } from 'react';
import { UserGroupIcon, BoltIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { ArrowTrendingUpIcon as ArrowTrendingUpIconSolid } from '@heroicons/react/24/solid';
import type { AuthUser } from '../app/page';

interface Analytics {
  total_tokens_in: number;
  total_tokens_out: number;
  top_users: { name: string; email: string; query_count: number }[];
  top_questions: { question: string; count: number }[];
  daily_usage: { day: string; queries: number }[];
}

export default function EnterpriseDashboard({ user, setActiveView }: { user: AuthUser; setActiveView: (v: any) => void }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const headers = { Authorization: `Bearer ${user.access_token}` };
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/enterprise/analytics`, { headers })
      .then(r => r.json())
      .then(d => { setAnalytics(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalTokens = analytics && analytics.total_tokens_in != null && analytics.total_tokens_out != null
    ? analytics.total_tokens_in + analytics.total_tokens_out : 0;
  const totalQueries = analytics && analytics.daily_usage
    ? analytics.daily_usage.reduce((s: number, d: any) => s + (d?.queries || 0), 0) : 0;
  const topUserCount = analytics?.top_users?.[0]?.query_count ?? 0;
  const maxDaily = analytics && analytics.daily_usage
    ? Math.max(...analytics.daily_usage.map((d: any) => d?.queries || 0), 1) : 1;

  const card = (label: string, value: string, sub?: string, accent?: string) => (
    <div className="rounded-3xl p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' }}>
      <div className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl opacity-[0.06]" style={{ background: accent || '#3b82f6', transform: 'translate(25%, -25%)' }} />
      <p className="text-[13px] font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        {accent && <span className="w-2 h-2 rounded-full" style={{ background: accent }} />}
        {label}
      </p>
      <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{value}</p>
      {sub && <p className="text-[12px] mt-2" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-8 py-10" style={{ background: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{user.enterprise_name}</p>
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ color: 'var(--text)' }}>Dashboard</h1>
            <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>Platform usage across all members.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setActiveView('users')}
              className="py-2.5 px-5 rounded-2xl text-[13px] font-semibold transition-all"
              style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              Manage Users
            </button>
            <button onClick={() => setActiveView('settings')}
              className="py-2.5 px-5 rounded-2xl text-[13px] font-semibold flex items-center gap-2 transition-all"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
              <BoltIcon className="w-4 h-4" /> Settings
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {card('Total Queries', totalQueries.toLocaleString(), undefined, '#3b82f6')}
              {card('Tokens Used', `${(totalTokens / 1000).toFixed(0)}K`, analytics && analytics.total_tokens_in != null && analytics.total_tokens_out != null ? `In: ${(analytics.total_tokens_in / 1000).toFixed(0)}K · Out: ${(analytics.total_tokens_out / 1000).toFixed(0)}K` : '—', '#60a5fa')}
              {card('Top User', topUserCount.toLocaleString(), analytics?.top_users?.[0]?.name || '—', '#34d399')}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Daily Usage */}
              <div className="rounded-3xl p-6" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' }}>
                <h3 className="font-bold mb-5 flex items-center gap-2 text-[14px]" style={{ color: 'var(--text)' }}>
                  <ArrowTrendingUpIconSolid className="w-5 h-5" style={{ color: '#3b82f6' }} />
                  Daily Queries (30d)
                </h3>
                {!analytics?.daily_usage?.length ? (
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No data yet.</p>
                ) : (
                  <div className="flex items-end gap-1 h-36">
                    {analytics.daily_usage.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div
                          className="w-full rounded-t-lg transition-all cursor-pointer"
                          style={{ height: `${Math.max(4, ((d?.queries || 0) / maxDaily) * 120)}px`, background: 'linear-gradient(to top, #3b82f6, rgba(59,130,246,0.4))' }}
                          title={`${d?.day || ''}: ${d?.queries || 0}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Questions */}
              <div className="rounded-3xl p-6" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' }}>
                <h3 className="font-bold mb-5 flex items-center gap-2 text-[14px]" style={{ color: 'var(--text)' }}>
                  <DocumentTextIcon className="w-5 h-5" style={{ color: '#3b82f6' }} />
                  Top Questions
                </h3>
                {!analytics?.top_questions?.length ? (
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No queries yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {analytics.top_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-[11px] font-bold w-5 shrink-0 mt-0.5 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] truncate" style={{ color: 'var(--text)' }}>{q?.question || ''}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{q?.count || 0}×</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* Top Users */}
            <div className="rounded-3xl p-6" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' }}>
              <h3 className="font-bold mb-5 flex items-center gap-2 text-[14px]" style={{ color: 'var(--text)' }}>
                <UserGroupIcon className="w-5 h-5" style={{ color: '#3b82f6' }} />
                Top Users
              </h3>
              {!analytics?.top_users?.length ? (
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No users yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
                        <th className="text-left py-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</th>
                        <th className="text-right py-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Queries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.top_users.map((u, i) => (
                        <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-3 font-medium" style={{ color: 'var(--text)' }}>{u?.name || '—'}</td>
                          <td className="py-3" style={{ color: 'var(--text-secondary)' }}>{u?.email || '—'}</td>
                          <td className="py-3 text-right font-bold" style={{ color: '#3b82f6' }}>{u?.query_count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

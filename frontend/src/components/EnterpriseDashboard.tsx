"use client";
import React, { useEffect, useState } from 'react';
import { ChartBarIcon, UserGroupIcon, BoltIcon, DocumentTextIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/solid';
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

  const totalTokens = analytics ? analytics.total_tokens_in + analytics.total_tokens_out : 0;
  const totalQueries = analytics ? analytics.daily_usage.reduce((s, d) => s + d.queries, 0) : 0;
  const topUserCount = analytics?.top_users?.[0]?.query_count ?? 0;

  const maxDaily = analytics ? Math.max(...analytics.daily_usage.map(d => d.queries), 1) : 1;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#050505] overflow-y-auto px-8 py-10 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-10">

        {/* Header */}
        <div className="flex items-end justify-between border-b border-slate-200 dark:border-slate-800/50 pb-8">
          <div>
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-1">{user.enterprise_name}</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Platform usage across all users.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setActiveView('users')} className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-5 rounded-xl text-sm hover:border-slate-300 transition-all">
              Manage Users
            </button>
            <button onClick={() => setActiveView('settings')} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 px-5 rounded-xl text-sm flex items-center gap-2 shadow-md transition-all">
              <BoltIcon className="w-4 h-4" /> Settings
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm animate-pulse">Loading analytics…</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <p className="text-slate-500 text-sm font-medium flex items-center gap-2"><ChartBarIcon className="w-4 h-4 text-red-500" /> Total Queries (30d)</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalQueries.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <p className="text-slate-500 text-sm font-medium flex items-center gap-2"><BoltIcon className="w-4 h-4 text-amber-500" /> Total Tokens Used</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{(totalTokens / 1000).toFixed(1)}K</p>
                <p className="text-xs text-slate-400 mt-1">In: {(analytics!.total_tokens_in / 1000).toFixed(1)}K · Out: {(analytics!.total_tokens_out / 1000).toFixed(1)}K</p>
              </div>
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <p className="text-slate-500 text-sm font-medium flex items-center gap-2"><UserGroupIcon className="w-4 h-4 text-blue-500" /> Top User Queries</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{topUserCount.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1 truncate">{analytics?.top_users?.[0]?.name || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Daily Usage Bar Chart */}
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><ArrowTrendingUpIcon className="w-5 h-5 text-red-500" /> Daily Queries (last 30 days)</h3>
                {analytics!.daily_usage.length === 0 ? (
                  <p className="text-slate-400 text-sm">No data yet.</p>
                ) : (
                  <div className="flex items-end gap-1 h-32">
                    {analytics!.daily_usage.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div
                          className="w-full rounded-t bg-red-500/80 hover:bg-red-500 transition-all"
                          style={{ height: `${Math.max(4, (d.queries / maxDaily) * 112)}px` }}
                          title={`${d.day}: ${d.queries} queries`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Questions */}
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><DocumentTextIcon className="w-5 h-5 text-blue-500" /> Top Questions</h3>
                {analytics!.top_questions.length === 0 ? (
                  <p className="text-slate-400 text-sm">No queries yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {analytics!.top_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-xs font-bold text-slate-400 w-5 shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{q.question}</p>
                          <p className="text-xs text-slate-400">{q.count}× asked</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* Top Users Table */}
            <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><UserGroupIcon className="w-5 h-5 text-green-500" /> Top Users by Activity</h3>
              {analytics!.top_users.length === 0 ? (
                <p className="text-slate-400 text-sm">No users have queried yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">User</th>
                        <th className="text-left py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">Email</th>
                        <th className="text-right py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">Queries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics!.top_users.map((u, i) => (
                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 font-medium text-slate-900 dark:text-white">{u.name || '—'}</td>
                          <td className="py-3 text-slate-500">{u.email}</td>
                          <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{u.query_count}</td>
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

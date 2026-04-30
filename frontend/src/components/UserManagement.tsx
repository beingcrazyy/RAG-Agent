"use client";
import React, { useEffect, useState } from 'react';
import { UserGroupIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import type { AuthUser } from '../app/page';

interface Member {
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  joined_at: string | null;
  query_count: number;
  token_total: number;
}

const statusColors: Record<string, string> = {
  active:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function UserManagement({ user }: { user: AuthUser }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const headers = { Authorization: `Bearer ${user.access_token}` };

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = () => {
    fetch(`${apiBase}/api/v1/enterprise/users`, { headers })
      .then(r => r.json())
      .then(d => { setMembers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchMembers(); }, []);

  const approve = async (userId: string) => {
    setActionLoading(userId + '-approve');
    await fetch(`${apiBase}/api/v1/enterprise/users/${userId}/approve`, { method: 'POST', headers });
    setActionLoading(null);
    fetchMembers();
  };

  const revoke = async (userId: string) => {
    setActionLoading(userId + '-revoke');
    await fetch(`${apiBase}/api/v1/enterprise/users/${userId}/revoke`, { method: 'POST', headers });
    setActionLoading(null);
    fetchMembers();
  };

  const pending = members.filter(m => m.status === 'pending');
  const active  = members.filter(m => m.status === 'active');
  const revoked = members.filter(m => m.status === 'revoked');

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#050505] overflow-y-auto px-8 py-10">
      <div className="max-w-5xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800/50 pb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <UserGroupIcon className="w-7 h-7 text-red-500" /> User Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">Approve, revoke, and track all users in your enterprise.</p>
        </div>

        {/* Pending Approvals */}
        {pending.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-6">
            <h3 className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5" /> {pending.length} Pending Approval{pending.length > 1 ? 's' : ''}
            </h3>
            <div className="space-y-3">
              {pending.map(m => (
                <div key={m.user_id} className="flex items-center justify-between bg-white dark:bg-[#111] rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-800/30">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{m.name || m.email}</p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approve(m.user_id)} disabled={actionLoading === m.user_id + '-approve'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => revoke(m.user_id)} disabled={actionLoading === m.user_id + '-revoke'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-all disabled:opacity-60">
                      <XCircleIcon className="w-3.5 h-3.5" /> Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Users Table */}
        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">All Members ({members.length})</h3>
          {loading ? (
            <p className="text-slate-400 text-sm animate-pulse">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-slate-400 text-sm">No users yet. Share your invite link to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {['Name', 'Email', 'Role', 'Status', 'Queries', 'Tokens', 'Actions'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 font-semibold text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.user_id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{m.name || '—'}</td>
                      <td className="py-3 pr-4 text-slate-500 text-xs">{m.email}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[m.status] || ''}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300 font-medium">{m.query_count}</td>
                      <td className="py-3 pr-4 text-slate-500 text-xs font-mono">{(m.token_total / 1000).toFixed(1)}K</td>
                      <td className="py-3">
                        <div className="flex gap-1.5">
                          {m.status !== 'active' && (
                            <button onClick={() => approve(m.user_id)} disabled={actionLoading === m.user_id + '-approve'}
                              className="px-2.5 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold rounded-lg hover:bg-green-200 transition-all disabled:opacity-60">
                              Approve
                            </button>
                          )}
                          {m.status === 'active' && m.role !== 'admin' && (
                            <button onClick={() => revoke(m.user_id)} disabled={actionLoading === m.user_id + '-revoke'}
                              className="px-2.5 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-200 transition-all disabled:opacity-60">
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

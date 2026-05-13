"use client";
import React, { useEffect, useState } from 'react';
import { UserGroupIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-8 py-10" style={{ background: 'var(--bg)' }}>
      <div className="max-w-5xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text)' }}>
            <UserGroupIcon className="w-7 h-7" style={{ color: '#3b82f6' }} /> User Management
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Approve, revoke, and track all users in your enterprise.</p>
        </div>

        {/* Pending Approvals */}
        {pending.length > 0 && (
          <div className="rounded-3xl p-6" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <h3 className="font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text)' }}>
              <ClockIcon className="w-5 h-5" style={{ color: '#3b82f6' }} /> {pending.length} Pending Approval{pending.length > 1 ? 's' : ''}
            </h3>
            <div className="space-y-3">
              {pending.map(m => (
                <div key={m.user_id} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{m.name || m.email}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approve(m.user_id)} disabled={actionLoading === m.user_id + '-approve'}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60"
                      style={{ background: '#3b82f6', boxShadow: '0 2px 6px rgba(59,130,246,0.2)' }}>
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => revoke(m.user_id)} disabled={actionLoading === m.user_id + '-revoke'}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-60"
                      style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      <XCircleIcon className="w-3.5 h-3.5" /> Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Users Table */}
        <div className="rounded-3xl p-6" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' }}>
          <h3 className="font-bold mb-5" style={{ color: 'var(--text)' }}>All Members ({members.length})</h3>
          {loading ? (
            <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No users yet. Share your invite link to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Queries', 'Tokens', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 pr-4 font-semibold text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.user_id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="py-3 pr-4 font-medium whitespace-nowrap" style={{ color: 'var(--text)' }}>{m.name || '—'}</td>
                      <td className="py-3 pr-4 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.email}</td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={m.role === 'admin' ? { background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' } : { background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={m.status === 'active' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e' } : m.status === 'pending' ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium" style={{ color: 'var(--text)' }}>{m.query_count}</td>
                      <td className="py-3 pr-4 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{(m.token_total / 1000).toFixed(1)}K</td>
                      <td className="py-3">
                        <div className="flex gap-1.5">
                          {m.status !== 'active' && (
                            <button onClick={() => approve(m.user_id)} disabled={actionLoading === m.user_id + '-approve'}
                              className="px-2.5 py-1 text-xs font-semibold rounded-xl transition-all disabled:opacity-60"
                              style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                              Approve
                            </button>
                          )}
                          {m.status === 'active' && m.role !== 'admin' && (
                            <button onClick={() => revoke(m.user_id)} disabled={actionLoading === m.user_id + '-revoke'}
                              className="px-2.5 py-1 text-xs font-semibold rounded-xl transition-all disabled:opacity-60"
                              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
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

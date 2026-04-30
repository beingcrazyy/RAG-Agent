"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import CurrentChat from '../components/CurrentChat';
import DocumentManager from '../components/DocumentManager';
import HomeDashboard from '../components/HomeDashboard';
import EnterpriseDashboard from '../components/EnterpriseDashboard';
import EnterpriseSettings from '../components/EnterpriseSettings';
import UserManagement from '../components/UserManagement';
import ErrorBoundary from '../components/ErrorBoundary';

export interface AuthUser {
  access_token: string;
  workspace_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  enterprise_id: string;
  enterprise_name: string;
  logo_url?: string | null;
  theme_json?: Record<string, string> | null;
}

type AuthMode = 'login' | 'register-enterprise' | 'register-user';
type AppView = 'home' | 'chat' | 'documents' | 'users' | 'settings';

function applyTheme(theme: Record<string, string> | null | undefined) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primary_color) root.style.setProperty('--brand-primary', theme.primary_color);
  if (theme.bg_color)      root.style.setProperty('--brand-bg', theme.bg_color);
  if (theme.text_color)    root.style.setProperty('--brand-text', theme.text_color);
}

// ── Auth Screen ───────────────────────────────────────────────────────────────

function AuthScreen({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingMsg, setPendingMsg] = useState('');

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // Enterprise register extra
  const [companyName, setCompanyName] = useState('');
  const [domains, setDomains] = useState('');
  // User register extra
  const [enterprises, setEnterprises] = useState<{ slug: string; name: string }[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (mode === 'register-user') {
      fetch(`${apiBase}/api/v1/auth/enterprises`)
        .then(r => r.json())
        .then(setEnterprises)
        .catch(() => {});
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingMsg('');
    setLoading(true);

    try {
      let url = '';
      let body: any = {};

      if (mode === 'login') {
        url = `${apiBase}/api/v1/auth/login`;
        body = { email, password };
      } else if (mode === 'register-enterprise') {
        url = `${apiBase}/api/v1/auth/register/enterprise`;
        body = {
          email, password, name,
          company_name: companyName,
          allowed_email_domains: domains ? domains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean) : [],
        };
      } else {
        url = `${apiBase}/api/v1/auth/register/user`;
        body = {
          email, password, name,
          enterprise_slug: selectedSlug || undefined,
          invite_code: inviteCode || undefined,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Something went wrong');
        return;
      }
      if (data.status === 'pending') {
        setPendingMsg(data.message);
        return;
      }

      localStorage.setItem('loomind_user', JSON.stringify(data));
      applyTheme(data.theme_json);
      onLogin(data as AuthUser);
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const brandColor = '#dc2626'; // default red-600

  return (
    <div className="w-screen h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-[#0a0a0a]">
      {/* Left branding panel */}
      <div className="flex-1 hidden md:flex flex-col items-center justify-center relative overflow-hidden" style={{ background: brandColor }}>
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10" />
        <div className="w-[800px] h-[800px] absolute rounded-full blur-[140px] -bottom-40 -left-40" style={{ background: `${brandColor}80` }} />
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg px-8">
          <img src="/logo.png" className="w-24 h-24 mb-6 shadow-2xl rounded-2xl" alt="Logo" />
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Loomind AI Engine</h1>
          <p className="text-red-100 text-lg">Your intelligent gateway to documents. Secure, agentic, and blazing fast.</p>
        </div>
      </div>

      {/* Right auth pane */}
      <div className="w-full md:w-[520px] shrink-0 bg-white dark:bg-[#111] flex flex-col items-center justify-center p-10 shadow-2xl z-10 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 mb-8">
            {(['login', 'register-enterprise', 'register-user'] as AuthMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setPendingMsg(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mode === m ? 'bg-white dark:bg-[#222] shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                {m === 'login' ? 'Login' : m === 'register-enterprise' ? 'Enterprise' : 'User'}
              </button>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {mode === 'login' ? 'Welcome back' : mode === 'register-enterprise' ? 'Create Enterprise' : 'Join an Enterprise'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            {mode === 'login' ? 'Sign in to your account.' : mode === 'register-enterprise' ? 'Set up your company RAG workspace.' : 'Sign up with your company invite or slug.'}
          </p>

          {pendingMsg ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-amber-800 dark:text-amber-300 text-sm">{pendingMsg}</div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode !== 'login' && (
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40" />
              )}
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40" />
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40" />

              {mode === 'register-enterprise' && (
                <>
                  <input required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40" />
                  <input value={domains} onChange={e => setDomains(e.target.value)} placeholder="Allowed email domains (e.g. acme.com, acme.org) — optional"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40" />
                </>
              )}

              {mode === 'register-user' && (
                <>
                  {enterprises.length > 0 ? (
                    <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/40">
                      <option value="">— Select your company —</option>
                      {enterprises.map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
                    </select>
                  ) : null}
                  <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Or paste invite code"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40" />
                </>
              )}

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 mt-1"
                style={{ background: brandColor }}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function RAGPlatformUI() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>('home');

  useEffect(() => {
    const saved = localStorage.getItem('loomind_user');
    if (saved) {
      try {
        const u = JSON.parse(saved) as AuthUser;
        setUser(u);
        applyTheme(u.theme_json);
      } catch {
        localStorage.removeItem('loomind_user');
      }
    }
  }, []);

  const handleLogin = (u: AuthUser) => {
    setUser(u);
    applyTheme(u.theme_json);
    setActiveView('home');
  };

  const handleLogout = () => {
    setUser(null);
    setActiveThreadId(null);
    setActiveView('home');
    localStorage.removeItem('loomind_user');
  };

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <main className="w-screen h-screen flex bg-slate-50 dark:bg-black overflow-hidden transition-colors">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        activeThreadId={activeThreadId}
        setActiveThreadId={setActiveThreadId}
        user={user}
        onLogout={handleLogout}
      />

      {activeView === 'home' && (
        <ErrorBoundary>
          {user.role === 'admin'
            ? <EnterpriseDashboard user={user} setActiveView={setActiveView} />
            : <HomeDashboard setActiveView={setActiveView} user={user} />}
        </ErrorBoundary>
      )}
      {activeView === 'chat' && <ErrorBoundary><CurrentChat activeThreadId={activeThreadId} user={user} /></ErrorBoundary>}
      {activeView === 'documents' && <ErrorBoundary><DocumentManager user={user} /></ErrorBoundary>}
      {activeView === 'users' && <ErrorBoundary><UserManagement user={user} /></ErrorBoundary>}
      {activeView === 'settings' && <ErrorBoundary><EnterpriseSettings user={user} /></ErrorBoundary>}
    </main>
  );
}


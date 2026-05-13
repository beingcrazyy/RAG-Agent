"use client";
import { useState, useEffect } from 'react';
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

function applyTheme(theme: Record<string, string> | null | undefined, isDark?: boolean) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primary_color) root.style.setProperty('--accent', theme.primary_color);
  // Only apply bg/text colors in light mode - dark mode handles these via Sidebar
  if (!isDark) {
    if (theme.bg_color) root.style.setProperty('--bg', theme.bg_color);
    if (theme.text_color) root.style.setProperty('--text', theme.text_color);
  }
}

// ── Auth Screen ───────────────────────────────────────────────────────────────

function AuthScreen({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingMsg, setPendingMsg] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [domains, setDomains] = useState('');
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
      applyTheme(data.theme_json, document.documentElement.classList.contains('dark'));
      onLogin(data as AuthUser);
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-[14px] text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all";

  return (
    <div className="w-screen h-screen flex">
      {/* Left branding panel — dark with background image */}
      <div className="flex-1 hidden lg:flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img src="/auth-bg.jpg" alt="" className="w-full h-full object-cover" />
          {/* Dark overlay so text is readable */}
          <div className="absolute inset-0 bg-[#0a0a1a]/90" />
          {/* Subtle gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a3e] via-[#0a0a1a] to-[#0d0d20]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          {/* Glow blobs */}
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px] bg-blue-600/10" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px] bg-purple-600/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[150px] bg-indigo-500/5" />
        </div>

        {/* Large watermark logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <img src="/logo.png" alt="" className="w-[320px] h-[320px] object-contain opacity-[0.04]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-md px-8">
          {/* Logo badge */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <img src="/logo.png" className="w-full h-full object-contain" alt="Loomind" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Loomind</h1>
          <p className="text-white/50 text-base leading-relaxed max-w-sm">Your intelligent gateway to documents. Secure, agentic, and blazing fast.</p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-10 justify-center">
            {['Secure', 'Agentic', 'Blazing Fast'].map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium text-white/60"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right auth pane */}
      <div className="w-full lg:w-[520px] shrink-0 bg-white flex flex-col items-center justify-center p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">
              {mode === 'login' ? 'Welcome back' : mode === 'register-enterprise' ? 'Create Enterprise' : 'Join an Enterprise'}
            </h2>
            <p className="text-slate-400 text-sm">
              {mode === 'login' ? 'Sign in to your account.' : mode === 'register-enterprise' ? 'Set up your company workspace.' : 'Sign up with your company invite.'}
            </p>
          </div>

          {pendingMsg ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-700 text-sm">{pendingMsg}</div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode !== 'login' && (
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                  className={inputCls} />
              )}
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"
                className={inputCls} />
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                className={inputCls} />

              {mode === 'register-enterprise' && (
                <>
                  <input required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name"
                    className={inputCls} />
                  <input value={domains} onChange={e => setDomains(e.target.value)} placeholder="Allowed email domains (e.g. acme.com) — optional"
                    className={inputCls} />
                </>
              )}

              {mode === 'register-user' && (
                <>
                  {enterprises.length > 0 ? (
                    <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}
                      className={inputCls}>
                      <option value="">— Select your company —</option>
                      {enterprises.map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
                    </select>
                  ) : null}
                  <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Or paste invite code"
                    className={inputCls} />
                </>
              )}

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-all disabled:opacity-50 mt-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20">
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          )}

          {!pendingMsg && mode === 'login' && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center mb-3">Don&apos;t have an account?</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setMode('register-user'); setError(''); }}
                  className="py-3 rounded-2xl text-sm font-semibold border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                  Sign up as User
                </button>
                <button onClick={() => { setMode('register-enterprise'); setError(''); }}
                  className="py-3 rounded-2xl text-sm font-semibold border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                  Sign up as Enterprise
                </button>
              </div>
            </div>
          )}
          {!pendingMsg && mode !== 'login' && (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <button onClick={() => { setMode('login'); setError(''); }}
                className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
                ← Back to Login
              </button>
            </div>
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
        applyTheme(u.theme_json, document.documentElement.classList.contains('dark'));
      } catch {
        localStorage.removeItem('loomind_user');
      }
    }
  }, []);

  const handleLogin = (u: AuthUser) => {
    setUser(u);
    applyTheme(u.theme_json, document.documentElement.classList.contains('dark'));
    setActiveView('home');
  };

  // Listen for settings updates (logo, name changes)
  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem('loomind_user');
      if (saved) {
        setUser(JSON.parse(saved));
      }
    };
    window.addEventListener('loomind_user_updated', handleUpdate);
    return () => window.removeEventListener('loomind_user_updated', handleUpdate);
  }, []);

  const handleLogout = () => {
    setUser(null);
    setActiveThreadId(null);
    setActiveView('home');
    localStorage.removeItem('loomind_user');
  };

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <main className="w-screen h-screen flex overflow-hidden">
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

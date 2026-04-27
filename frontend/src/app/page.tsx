"use client";
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import CurrentChat from '../components/CurrentChat';
import DocumentManager from '../components/DocumentManager';
import HomeDashboard from '../components/HomeDashboard';
import ErrorBoundary from '../components/ErrorBoundary';

interface AuthUser {
  access_token: string;
  workspace_id: string;
  user_id: string;
  name: string;
  email: string;
}

export default function RAGPlatformUI() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'home' | 'chat' | 'documents'>('home');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('loomind_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('loomind_user');
      }
    }
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@loomind.ai', name: 'Demo User' })
      });
      if (!res.ok) throw new Error('Login failed');
      const data: AuthUser = await res.json();
      setUser(data);
      localStorage.setItem('loomind_user', JSON.stringify(data));
    } catch (e) {
      console.error('Login error:', e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveThreadId(null);
    setActiveView('home');
    localStorage.removeItem('loomind_user');
  };

  if (!user) {
    return (
      <div className="w-screen h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-[#0a0a0a] transition-colors relative">
        
        {/* Left Side: Branding Banner */}
        <div className="flex-1 bg-red-600 dark:bg-black dark:border-r border-slate-800 hidden md:flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10" />
          <div className="w-[800px] h-[800px] bg-red-500/50 absolute rounded-full blur-[140px] -bottom-40 -left-40 mix-blend-screen" />
          
          <div className="relative z-10 flex flex-col items-center text-center max-w-lg px-8">
            <img src="/logo.png" className="w-24 h-24 mb-6 shadow-2xl rounded-2xl" alt="Loomind Logo" />
            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Loomind AI Engine</h1>
            <p className="text-red-100 text-lg">Your intelligent gateway to documents. Secure, agentic, and blazing fast.</p>
          </div>
        </div>

        {/* Right Side: Login Pane */}
        <div className="w-full md:w-[500px] shrink-0 bg-white dark:bg-[#111] flex flex-col items-center justify-center p-12 shadow-2xl z-10">
          <div className="w-full max-w-sm flex flex-col items-center">
            
            <h2 className="text-[28px] font-bold text-slate-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-10 text-center text-[15px]">Sign in securely with your Google Workspace account to access Loomind.</p>
            
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-4 bg-white dark:bg-black border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-semibold py-3.5 px-6 rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-60"
            >
              {isLoggingIn ? (
                <span className="animate-pulse">Authenticating...</span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <div className="flex items-center w-full my-8">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
              <span className="px-4 text-xs font-medium text-slate-400 uppercase tracking-widest">Enterprise</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
            </div>

            <p className="text-center text-xs text-slate-400">By continuing, you agree to the Loomind Terms of Service.</p>
          </div>
        </div>
      </div>
    );
  }

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
      
      {activeView === 'home' && <ErrorBoundary><HomeDashboard setActiveView={setActiveView} /></ErrorBoundary>}
      {activeView === 'chat' && <ErrorBoundary><CurrentChat activeThreadId={activeThreadId} user={user} /></ErrorBoundary>}
      {activeView === 'documents' && <ErrorBoundary><DocumentManager user={user} /></ErrorBoundary>}
    </main>
  );
}

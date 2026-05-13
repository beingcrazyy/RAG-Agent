"use client";

import React, { useState, useEffect } from 'react';
import { HomeIcon, ChatBubbleLeftRightIcon, PlusIcon, DocumentTextIcon, Cog8ToothIcon, TrashIcon, ArrowLeftEndOnRectangleIcon, Bars3Icon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { UserGroupIcon as UserGroupIconOutline } from '@heroicons/react/24/outline';

export default function Sidebar({ activeView, setActiveView, activeThreadId, setActiveThreadId, user, onLogout }: any) {
  const [threads, setThreads] = React.useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [brandName, setBrandName] = useState(user?.enterprise_name || 'Loomind');
  const [logoSrc, setLogoSrc] = useState(user?.logo_url ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${user.logo_url}` : '/logo.png');
  const [logoVersion, setLogoVersion] = useState(0);
  const isAdmin = user?.role === 'admin';

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const authHeader = { "Authorization": `Bearer ${user?.access_token}` };
  const workspaceId = user?.workspace_id;

  // Initial theme setup
  useEffect(() => {
    const saved = localStorage.getItem('loomind-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);

    if (shouldBeDark) {
      document.documentElement.style.setProperty('--bg', '#0f0f0f');
      document.documentElement.style.setProperty('--bg-sidebar', '#141414');
      document.documentElement.style.setProperty('--text', 'rgba(255,255,255,0.9)');
      document.documentElement.style.setProperty('--text-secondary', 'rgba(255,255,255,0.5)');
      document.documentElement.style.setProperty('--text-muted', 'rgba(255,255,255,0.3)');
      document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.08)');
      document.documentElement.style.setProperty('--surface', 'rgba(255,255,255,0.04)');
      document.documentElement.style.setProperty('--surface-hover', 'rgba(255,255,255,0.08)');
    } else {
      document.documentElement.style.setProperty('--bg', '#f8f8f8');
      document.documentElement.style.setProperty('--bg-sidebar', '#ffffff');
      document.documentElement.style.setProperty('--text', 'rgba(0,0,0,0.88)');
      document.documentElement.style.setProperty('--text-secondary', 'rgba(0,0,0,0.5)');
      document.documentElement.style.setProperty('--text-muted', 'rgba(0,0,0,0.3)');
      document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.07)');
      document.documentElement.style.setProperty('--surface', 'rgba(0,0,0,0.03)');
      document.documentElement.style.setProperty('--surface-hover', 'rgba(0,0,0,0.06)');
    }
  }, []);

  // Sync brand name + logo when user prop changes (e.g. after settings save)
  useEffect(() => {
    setBrandName(user?.enterprise_name || 'Loomind');
    setLogoSrc(user?.logo_url ? `${apiBase}${user.logo_url}` : '/logo.png');
    setLogoVersion(v => v + 1);
  }, [user?.enterprise_name, user?.logo_url, apiBase]);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('loomind-theme', next ? 'dark' : 'light');
    if (next) {
      document.documentElement.style.setProperty('--bg', '#0f0f0f');
      document.documentElement.style.setProperty('--bg-sidebar', '#141414');
      document.documentElement.style.setProperty('--text', 'rgba(255,255,255,0.9)');
      document.documentElement.style.setProperty('--text-secondary', 'rgba(255,255,255,0.5)');
      document.documentElement.style.setProperty('--text-muted', 'rgba(255,255,255,0.3)');
      document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.08)');
      document.documentElement.style.setProperty('--surface', 'rgba(255,255,255,0.04)');
      document.documentElement.style.setProperty('--surface-hover', 'rgba(255,255,255,0.08)');
    } else {
      document.documentElement.style.setProperty('--bg', '#f8f8f8');
      document.documentElement.style.setProperty('--bg-sidebar', '#ffffff');
      document.documentElement.style.setProperty('--text', 'rgba(0,0,0,0.88)');
      document.documentElement.style.setProperty('--text-secondary', 'rgba(0,0,0,0.5)');
      document.documentElement.style.setProperty('--text-muted', 'rgba(0,0,0,0.3)');
      document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.07)');
      document.documentElement.style.setProperty('--surface', 'rgba(0,0,0,0.03)');
      document.documentElement.style.setProperty('--surface-hover', 'rgba(0,0,0,0.06)');
    }
  };

  const fetchThreads = () => {
    if (!workspaceId) return;
    fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, { headers: authHeader })
      .then(res => res.json())
      .then(data => setThreads(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const refreshUser = () => {
    const saved = localStorage.getItem('loomind_user');
    if (saved) {
      const u = JSON.parse(saved);
      setBrandName(u.enterprise_name || 'Loomind');
      setLogoSrc(u.logo_url ? `${apiBase}${u.logo_url}` : '/logo.png');
      setLogoVersion(v => v + 1);
    }
  };

  useEffect(() => {
    fetchThreads();
    window.addEventListener('chat_threads_updated', fetchThreads);
    window.addEventListener('loomind_user_updated', refreshUser);
    return () => {
      window.removeEventListener('chat_threads_updated', fetchThreads);
      window.removeEventListener('loomind_user_updated', refreshUser);
    };
  }, []);

  const handleNewThread = async () => {
    if (!workspaceId) return;
    const res = await fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, { method: "POST", headers: authHeader });
    const data = await res.json();
    setActiveThreadId(data.id);
    setActiveView('chat');
    fetchThreads();
  };

  const handleDeleteThread = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`${apiBase}/api/v1/chat/threads/${id}`, { method: "DELETE", headers: authHeader });
    if (activeThreadId === id) { setActiveThreadId(null); setActiveView('home'); }
    fetchThreads();
  };

  const navItem = (view: string, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => { setActiveView(view); if (view !== 'chat') setActiveThreadId(null); }}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-[14px] font-medium"
      style={{
        color: activeView === view ? '#3b82f6' : 'var(--text-secondary)',
        background: activeView === view ? 'rgba(59,130,246,0.08)' : 'transparent',
      }}
    >
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5 shrink-0' })}
      {!isCollapsed && <span>{label}</span>}
    </button>
  );

  return (
    <div className={`${isCollapsed ? 'w-[72px]' : 'w-[260px]'} shrink-0 flex flex-col h-full relative transition-all duration-300`}
      style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>

      {/* Logo + Collapse */}
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center flex-col' : 'justify-between'} mb-3`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>
              <img src={`${logoSrc}?v=${logoVersion}`} alt={brandName} className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ color: 'var(--text)' }}>{brandName}</span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-4 overflow-hidden shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>
            <img src={`${logoSrc}?v=${logoVersion}`} alt={brandName} className="w-full h-full object-contain" />
          </div>
        )}
        <button onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          <Bars3Icon className="w-5 h-5" />
        </button>
      </div>

      {/* Main Nav */}
      <div className="px-3 space-y-1">
        {navItem('home', <HomeIcon />, isAdmin ? 'Dashboard' : 'Home')}

        <button
          onClick={handleNewThread}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all text-[14px] font-medium"
          style={{ color: '#fff', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}
        >
          <div className="flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>New Chat</span>}
          </div>
          {!isCollapsed && <PlusIcon className="w-4 h-4" />}
        </button>

        {isAdmin && navItem('documents', <DocumentTextIcon />, 'Knowledge Base')}
        {isAdmin && navItem('users', <UserGroupIconOutline />, 'Users')}
        {isAdmin && navItem('settings', <Cog8ToothIcon />, 'Settings')}
      </div>

      {/* Chat History */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'} mt-5 flex flex-col gap-0.5`}
        style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
        {!isCollapsed && <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--text-muted)' }}>History</h3>}
        {threads.map((chat) => (
          <div key={chat.id} className="group relative">
            <button
              onClick={() => { setActiveThreadId(chat.id); setActiveView('chat'); }}
              className="w-full text-left py-2.5 px-2 rounded-2xl flex items-center gap-3 transition-all text-[13px]"
              style={{
                color: activeThreadId === chat.id && activeView === 'chat' ? '#3b82f6' : 'var(--text-secondary)',
                background: activeThreadId === chat.id && activeView === 'chat' ? 'rgba(59,130,246,0.08)' : 'transparent',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: activeThreadId === chat.id && activeView === 'chat' ? '#3b82f6' : 'var(--border)',
                }} />
              {!isCollapsed && <span className="flex-1 truncate">{chat.title}</span>}
            </button>
            {!isCollapsed && (
              <button
                onClick={(e) => handleDeleteThread(e, chat.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: 'var(--surface-hover)' }}
              >
                <TrashIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bottom strip */}
      <div className={`p-4 flex flex-col gap-3 ${isCollapsed ? 'items-center' : ''}`}
        style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={toggleDark} className="p-2 rounded-xl transition-colors self-start"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-3'}`}>
          <div className="w-9 h-9 shrink-0 rounded-2xl flex items-center justify-center font-bold text-[13px] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: '0 2px 6px rgba(59,130,246,0.2)' }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-[13px] tracking-tight truncate" style={{ color: 'var(--text)' }}>{user?.name || 'User'}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{user?.role === 'admin' ? '● Admin' : '● Member'}</span>
            </div>
          )}
          <button onClick={onLogout} className="p-2 rounded-xl transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
            <ArrowLeftEndOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

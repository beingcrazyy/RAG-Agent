"use client";

import React, { useState, useEffect } from 'react';
import { HomeIcon, ChatBubbleLeftRightIcon, PlusIcon, DocumentTextIcon, Cog8ToothIcon, TrashIcon, ArrowLeftEndOnRectangleIcon, Bars3Icon, SunIcon, MoonIcon, UserGroupIcon, ChartBarIcon } from '@heroicons/react/24/solid';

export default function Sidebar({ activeView, setActiveView, activeThreadId, setActiveThreadId, user, onLogout }: any) {
  const [threads, setThreads] = React.useState<any[]>([]);
  const [isDark, setIsDark] = useState(false);
  const isAdmin = user?.role === 'admin';

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const authHeader = { "Authorization": `Bearer ${user?.access_token}` };
  const workspaceId = user?.workspace_id;

  const logoSrc = user?.logo_url ? `${apiBase}${user.logo_url}` : '/logo.png';
  const brandName = user?.enterprise_name || 'Loomind';

  useEffect(() => {
    const saved = localStorage.getItem('loomind-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('loomind-theme', next ? 'dark' : 'light');
  };

  const fetchThreads = () => {
    if (!workspaceId) return;
    fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, { headers: authHeader })
      .then(res => res.json())
      .then(data => setThreads(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  React.useEffect(() => {
    fetchThreads();
    window.addEventListener('chat_threads_updated', fetchThreads);
    return () => window.removeEventListener('chat_threads_updated', fetchThreads);
  }, []);

  const handleNewThread = async () => {
    if (!workspaceId) return;
    const res = await fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, {
      method: "POST", headers: authHeader
    });
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

  // Nav Item Builder
  const navItem = (view: string, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => { setActiveView(view); if (view !== 'chat') setActiveThreadId(null); }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeView === view ? 'bg-[var(--color-brand-primary)] text-white shadow-md' : 'text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] hover:bg-slate-200/50 dark:hover:bg-slate-800 hover:text-[var(--color-light-text-primary)] dark:hover:text-[var(--color-dark-text-primary)]'}`}
      title={label}
    >
      <div className="w-5 h-5 shrink-0 flex items-center justify-center">{icon}</div>
      <span className="text-[14px]">{label}</span>
    </button>
  );

  return (
    <div className="w-[280px] shrink-0 border-r border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-light-sidebar)] dark:bg-[var(--color-dark-sidebar)] flex flex-col h-full relative z-10 transition-all duration-300">

      {/* Top: Logo & Enterprise Name */}
      <div className="p-5 flex items-center gap-3">
        <img src={logoSrc} alt={brandName} className="w-8 h-8 rounded-lg shadow-sm object-contain bg-white" />
        <span className="font-bold text-[18px] tracking-tight text-[var(--color-light-text-primary)] dark:text-[var(--color-dark-text-primary)] truncate max-w-[190px]">{brandName}</span>
      </div>

      {/* Middle: Navigation Menu */}
      <div className="px-4 space-y-1">
        {navItem('chat', <ChatBubbleLeftRightIcon />, 'AI Chat')}
        {isAdmin && navItem('documents', <DocumentTextIcon />, 'Documents')}
        {isAdmin && navItem('home', <ChartBarIcon />, 'Admin Dashboard')}
        {isAdmin && navItem('settings', <Cog8ToothIcon />, 'Workspace Settings')}
      </div>

      {/* Chat History - Only show for Members or generally visible */}
      <div className="flex-1 overflow-y-auto px-5 mt-8 flex flex-col gap-2 scrollbar-thin">
        <h3 className="text-[11px] font-bold text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] uppercase tracking-widest mb-2 px-1">Recent Chats</h3>
        {threads.map((chat) => (
          <div key={chat.id} className="group relative">
            <button
              title={chat.title}
              onClick={() => { setActiveThreadId(chat.id); setActiveView('chat'); }}
              className={`w-full text-left py-2 px-2 rounded-lg flex items-center gap-3 ${activeThreadId === chat.id ? 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]' : 'text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] hover:bg-slate-200/50 dark:hover:bg-slate-800'} transition-colors`}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeThreadId === chat.id ? 'bg-[var(--color-brand-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="flex-1 truncate text-[13px]">{chat.title}</span>
            </button>
            <button
              onClick={(e) => handleDeleteThread(e, chat.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1.5 bg-white dark:bg-[#1B1F2A] shadow-sm rounded-md transition-all"
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom: User Profile & Logout */}
      <div className="p-4 mt-auto border-t border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] flex flex-col gap-3">
        <div className="flex items-center justify-between w-full text-slate-500 mb-1">
           <button onClick={toggleDark} className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors" title="Toggle Theme">
             {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
           </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 w-full min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-brand-primary)] text-white flex items-center justify-center overflow-hidden font-bold text-sm shadow-sm">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col flex-1 min-w-0 pr-2">
              <span className="font-semibold text-[14px] tracking-tight text-[var(--color-light-text-primary)] dark:text-[var(--color-dark-text-primary)] truncate">{user?.name || 'User'}</span>
              <span className="text-[11px] font-medium text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${user?.role === 'admin' ? 'bg-[var(--color-brand-primary)]' : 'bg-slate-400'}`}></div>
                {user?.role === 'admin' ? 'Admin' : 'Member'}
              </span>
            </div>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all shrink-0" title="Logout">
              <ArrowLeftEndOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
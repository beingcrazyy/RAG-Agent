"use client";

import React, { useState, useEffect } from 'react';
import { HomeIcon, ChatBubbleLeftRightIcon, PlusIcon, DocumentTextIcon, Cog8ToothIcon, TrashIcon, ArrowLeftEndOnRectangleIcon, Bars3Icon, SunIcon, MoonIcon } from '@heroicons/react/24/solid';

export default function Sidebar({ activeView, setActiveView, activeThreadId, setActiveThreadId, user, onLogout }: any) {
  const [threads, setThreads] = React.useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const authHeader = { "Authorization": `Bearer ${user?.access_token}` };
  const workspaceId = user?.workspace_id;

  // On mount: read saved preference, apply to html element
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
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, {
      headers: authHeader
    })
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
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, {
      method: "POST",
      headers: authHeader
    });
    const data = await res.json();
    setActiveThreadId(data.id);
    setActiveView('chat');
    fetchThreads();
  };

  const handleDeleteThread = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    await fetch(`${apiBase}/api/v1/chat/threads/${id}`, {
      method: "DELETE",
      headers: authHeader
    });
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setActiveView('home');
    }
    fetchThreads();
  };

  return (
    <div className={`${isCollapsed ? 'w-[80px]' : 'w-[280px]'} shrink-0 border-r border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0a0a0a] flex flex-col h-full relative z-10 transition-all duration-300`}>
      
      {/* Top Header: Logo & Collapse Trigger */}
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'} mb-4`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 cursor-pointer">
            <img src="/logo.png" alt="Loomind" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="font-bold text-[18px] tracking-tight text-slate-900 dark:text-white">Loomind</span>
          </div>
        )}
        {isCollapsed && (
          <img src="/logo.png" alt="Loomind" className="w-8 h-8 rounded-lg shadow-sm mb-4 cursor-pointer" />
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
      </div>

      {/* Main Nav */}
      <div className="px-3 space-y-1">
        <button 
          onClick={() => { setActiveView('home'); setActiveThreadId(null); }}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl transition-all ${activeView === 'home' ? 'bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400 font-semibold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'}`}
          title="Home"
        >
          <HomeIcon className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-[14px]">Home</span>}
        </button>

        <button 
          onClick={handleNewThread}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all font-medium`}
          title="New Chat"
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <ChatBubbleLeftRightIcon className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="text-[14px]">New Chat</span>}
          </div>
          {!isCollapsed && <PlusIcon className="w-4 h-4 text-slate-400" />}
        </button>

        <button 
          onClick={() => setActiveView('documents')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl transition-all ${activeView === 'documents' ? 'bg-red-50 text-red-600 dark:bg-red-900/10 dark:text-red-400 font-semibold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'}`}
          title="Documents"
        >
          <DocumentTextIcon className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-[14px]">Documents</span>}
        </button>
      </div>

      {/* Embedded History */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'} mt-8 flex flex-col gap-2`}>
        {!isCollapsed && <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">History</h3>}
        {threads.map((chat) => (
          <div key={chat.id} className="group relative">
            <button 
              title={chat.title}
              onClick={() => { setActiveThreadId(chat.id); setActiveView('chat'); }}
              className={`w-full text-left py-2 ${isCollapsed ? 'px-0 justify-center' : 'px-2'} rounded-lg flex items-center gap-3 ${activeThreadId === chat.id && activeView === 'chat' ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-semibold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'} transition-colors`}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeThreadId === chat.id && activeView === 'chat' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-600'}`} />
              {!isCollapsed && <span className="flex-1 truncate text-[13px]">{chat.title}</span>}
            </button>
            {!isCollapsed && (
              <button 
                onClick={(e) => handleDeleteThread(e, chat.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1.5 bg-white dark:bg-[#0a0a0a] shadow-sm tracking-tighter rounded-md transition-all"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Settings / Controls Strip */}
      <div className={`p-4 mt-auto border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-2 ${isCollapsed ? 'items-center' : ''}`}>
         
         <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'justify-between'} w-full mb-2`}>
           <button 
             onClick={toggleDark}
             className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
             title="Toggle Theme"
           >
             {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
           </button>
           <button 
             className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
             title="Settings"
           >
             <Cog8ToothIcon className="w-5 h-5" />
           </button>
         </div>

         <div className={`flex items-center ${isCollapsed ? 'justify-center border-t border-transparent pt-0' : 'gap-3 border-t border-slate-100 dark:border-slate-800/50 pt-4'}`}>
            <div className="w-8 h-8 shrink-0 rounded-full bg-red-500 text-white flex items-center justify-center overflow-hidden font-bold text-xs shadow-sm">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold text-[13px] tracking-tight text-slate-900 dark:text-white truncate">{user?.name || 'User'}</span>
                <span className="text-[11px] text-slate-400 truncate">{user?.email || ''}</span>
              </div>
            )}
            {!isCollapsed && (
              <button 
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                title="Logout"
              >
                <ArrowLeftEndOnRectangleIcon className="w-5 h-5" />
              </button>
            )}
         </div>
         {isCollapsed && (
              <button 
                onClick={onLogout}
                className="mt-2 p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                title="Logout"
              >
                <ArrowLeftEndOnRectangleIcon className="w-5 h-5" />
              </button>
         )}

      </div>

    </div>
  );
}

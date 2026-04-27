"use client";

import React from 'react';
import { MessageSquare, Plus, MessageCircle, Settings, Trash2 } from 'lucide-react';

export default function ChatHistoryPanel({ activeThreadId, setActiveThreadId }: { activeThreadId: string | null, setActiveThreadId: (id: string | null) => void }) {
  const [threads, setThreads] = React.useState<any[]>([]);

  const fetchThreads = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiBase}/api/v1/chat/threads`, {
      headers: { "Authorization": "Bearer mock-token" }
    })
    .then(res => res.json())
    .then(data => setThreads(data))
    .catch(err => console.error(err));
  };

  React.useEffect(() => {
    fetchThreads();
  }, []);

  const handleNewThread = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBase}/api/v1/chat/threads`, {
      method: "POST",
      headers: { "Authorization": "Bearer mock-token" }
    });
    const data = await res.json();
    setActiveThreadId(data.id);
    fetchThreads();
  };

  const handleDeleteThread = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    await fetch(`${apiBase}/api/v1/chat/threads/${id}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer mock-token" }
    });
    if (activeThreadId === id) setActiveThreadId(null);
    fetchThreads();
  };

  return (
    <div className="w-[280px] shrink-0 border-r border-slate-800 bg-[#0B0F19]/50 flex flex-col h-full relative z-10 glass-panel">
      
      {/* Header */}
      <div className="p-5 border-b border-slate-800/80">
        <h1 className="text-xl font-bold bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-2 mb-6">
          <MessageCircle className="text-sky-400" /> Workspace
        </h1>
        <button 
          onClick={handleNewThread}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 px-4 font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {threads.map((chat) => (
          <div key={chat.id} className="group relative">
            <button 
              onClick={() => setActiveThreadId(chat.id)}
              className={`w-full text-left px-3 py-3 rounded-lg flex items-start gap-3 border ${activeThreadId === chat.id ? 'bg-slate-800 border-sky-500/50' : 'hover:bg-slate-800/50 border-transparent hover:border-slate-700/50'} transition-colors`}
            >
              <MessageSquare size={16} className={`${activeThreadId === chat.id ? 'text-sky-400' : 'text-slate-400'} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0 pr-6">
                <p className={`text-[13px] font-medium truncate ${activeThreadId === chat.id ? 'text-sky-100' : 'text-slate-200'}`}>{chat.title}</p>
                <p className="text-[11px] text-slate-500 mt-1">{chat.date}</p>
              </div>
            </button>
            <button 
              onClick={(e) => handleDeleteThread(e, chat.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1.5 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer Profile */}
      <div className="p-4 border-t border-slate-800/80 hover:bg-slate-800/30 transition-colors cursor-pointer flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold shadow-lg">
          U
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">User Account</span>
          <span className="text-xs text-slate-400">Pro Tier</span>
        </div>
        <Settings size={16} className="text-slate-400 ml-auto" />
      </div>
    </div>
  );
}

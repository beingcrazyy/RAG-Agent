"use client";

import React from 'react';
import { ChatBubbleLeftRightIcon, DocumentTextIcon, BoltIcon } from '@heroicons/react/24/solid';
import type { AuthUser } from '../app/page';

export default function HomeDashboard({ setActiveView, user }: { setActiveView: (v: any) => void; user?: AuthUser }) {
  const firstName = user?.name?.split(' ')[0] || 'there';
  const enterpriseName = user?.enterprise_name || 'your workspace';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#050505] overflow-y-auto px-8 py-12 transition-colors">
      <div className="max-w-3xl mx-auto w-full space-y-10">

        <div className="border-b border-slate-200 dark:border-slate-800/50 pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Hello, {firstName}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Welcome to <span className="font-semibold text-slate-700 dark:text-slate-300">{enterpriseName}</span>&apos;s knowledge base.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => setActiveView('chat')}
            className="bg-red-600 hover:bg-red-500 text-white rounded-2xl p-6 text-left shadow-md transition-all group"
          >
            <ChatBubbleLeftRightIcon className="w-8 h-8 mb-3 opacity-90" />
            <p className="font-bold text-lg">Start a Chat</p>
            <p className="text-red-100 text-sm mt-1">Ask questions across all your company documents — see suggestions inside chat.</p>
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <BoltIcon className="w-5 h-5 text-amber-500" /> Quick Tips
          </h3>
          <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <li>- Ask specific questions -- the AI searches your documents, not the internet.</li>
            <li>- For financial data, include the year or period in your question.</li>
            <li>- Click &quot;View Sources&quot; on any answer to see which documents were used.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
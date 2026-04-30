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
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Hello, {firstName} 👋</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Welcome to <span className="font-semibold text-slate-700 dark:text-slate-300">{enterpriseName}</span>'s knowledge base.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveView('chat')}
            className="bg-red-600 hover:bg-red-500 text-white rounded-2xl p-6 text-left shadow-md transition-all group"
          >
            <ChatBubbleLeftRightIcon className="w-8 h-8 mb-3 opacity-90" />
            <p className="font-bold text-lg">Start a Chat</p>
            <p className="text-red-100 text-sm mt-1">Ask questions across all your company documents.</p>
          </button>

          <button
            onClick={() => setActiveView('documents')}
            className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-all"
          >
            <DocumentTextIcon className="w-8 h-8 mb-3 text-blue-500" />
            <p className="font-bold text-lg text-slate-900 dark:text-white">Browse Documents</p>
            <p className="text-slate-400 text-sm mt-1">View all files uploaded to your workspace.</p>
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <BoltIcon className="w-5 h-5 text-amber-500" /> Quick Tips
          </h3>
          <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <li>• Ask specific questions — the AI searches your documents, not the internet.</li>
            <li>• For financial data, include the year or period in your question.</li>
            <li>• Click "View Sources" on any answer to see which documents were used.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#050505] overflow-y-auto px-8 py-12 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        
        {/* Dynamic Hero greeting */}
        <div className="flex items-end justify-between border-b border-slate-200 dark:border-slate-800/50 pb-8">
          <div className="space-y-4">
            <h1 className="text-[44px] font-bold tracking-tight text-slate-900 dark:text-white">
              Good morning, Sam
            </h1>
            <h2 className="text-[20px] font-medium text-slate-500 dark:text-slate-400">Here is what is happening in your workspace today.</h2>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <button 
               onClick={() => setActiveView('documents')}
               className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2.5 px-5 rounded-xl shadow-sm transition-all text-sm"
            >
              Manage Data
            </button>
            <button 
               onClick={() => setActiveView('chat')}
               className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 px-5 rounded-xl shadow-md transition-all text-sm flex items-center gap-2"
            >
               <BoltIcon className="w-4 h-4" /> Start Orchestration
            </button>
          </div>
        </div>

        {/* Global Widget Array */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          
          {/* Main Content (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                 <p className="text-slate-500 text-sm font-medium">Synced Documents</p>
                 <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">1,248</p>
              </div>
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                 <p className="text-slate-500 text-sm font-medium">Vector Tokens</p>
                 <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">48.2M</p>
              </div>
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                 <p className="text-slate-500 text-sm font-medium">Active Threads</p>
                 <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">14</p>
              </div>
            </div>

            {/* Quick Tasks Grid */}
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Suggested Workflows</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="bg-gradient-to-br from-red-500 to-red-600 dark:from-red-900/40 dark:to-red-900/20 border border-red-500 dark:border-red-800/50 rounded-3xl p-6 shadow-md hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform"><ChartBarIcon className="w-24 h-24 text-white"/></div>
                    <p className="text-red-100 dark:text-red-300 text-[13px] font-semibold flex items-center gap-2 mb-2 uppercase tracking-widest relative z-10"><ChartBarIcon className="w-4 h-4"/> Financials</p>
                    <p className="text-xl font-bold tracking-tight text-white relative z-10 w-2/3">Generate Q4 P&L Layout</p>
                 </div>
                 <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                    <p className="text-slate-400 dark:text-slate-500 text-[13px] font-semibold flex items-center gap-2 mb-2 uppercase tracking-widest"><PlayCircleIcon className="w-4 h-4"/> Strategy</p>
                    <p className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200">Draft Executive Summary</p>
                 </div>
              </div>
            </div>
            
          </div>

          {/* Right Column: Recent Activity & Files */}
          <div className="space-y-6">
            
            {/* Recent Files Card */}
            <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-red-500" /> Recent Files
                </h3>
              </div>
              <div className="space-y-1 flex-1 overflow-y-auto pr-2">
                 {[
                   { name: "2025_Q1_Roadmap.pdf", tag: "PDF", color: "bg-red-500", time: "2h ago" },
                   { name: "Server_Logs_Prod.json", tag: "JSON", color: "bg-amber-500", time: "4h ago" },
                   { name: "Meeting_Transcript.txt", tag: "TXT", color: "bg-slate-500", time: "Yesterday" },
                   { name: "Marketing_Copy_V3.docx", tag: "DOC", color: "bg-blue-500", time: "Yesterday" },
                 ].map((file, i) => (
                   <div key={i} className="flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-black/40 p-2.5 rounded-2xl cursor-pointer transition-colors group">
                     <div className={`w-10 h-10 rounded-xl ${file.color} flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0`}>{file.tag}</div>
                     <div className="flex flex-col min-w-0">
                       <span className="font-semibold text-[14px] text-slate-900 dark:text-slate-200 truncate">{file.name}</span>
                       <span className="text-[12px] text-slate-400 flex items-center gap-1"><ClockIcon className="w-3 h-3"/> {file.time}</span>
                     </div>
                   </div>
                 ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                 <button onClick={() => setActiveView('documents')} className="text-slate-600 dark:text-slate-400 text-sm font-semibold hover:text-red-500 transition-colors flex items-center gap-1 group">View All <ArrowRightCircleIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/></button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

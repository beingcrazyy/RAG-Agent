"use client";

import React, { useState } from 'react';
import { FolderIcon, DocumentTextIcon, CloudArrowUpIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { AuthUser } from '../app/page';

export default function DocumentManager({ user }: { user: AuthUser }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const authHeader = { "Authorization": `Bearer ${user?.access_token}` };
  const workspaceId = user?.workspace_id;
  const isAdmin = user?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dynamicDocs, setDynamicDocs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('All Documents');

  const categorize = (name: string) => {
    const raw = name.toLowerCase();
    if (raw.endsWith('.pdf')) return 'PDF Documents';
    if (raw.endsWith('.jpg') || raw.endsWith('.jpeg') || raw.endsWith('.png') || raw.endsWith('.svg')) return 'Image Assets';
    if (raw.endsWith('.xls') || raw.endsWith('.xlsx') || raw.endsWith('.csv')) return 'Spreadsheets';
    if (raw.endsWith('.doc') || raw.endsWith('.docx') || raw.endsWith('.txt')) return 'Text Documents';
    return 'Other Formats';
  };

  const handleDeleteDocument = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`${apiBase}/api/v1/documents/${id}`, { method: "DELETE", headers: authHeader });
      setDynamicDocs(prev => prev.filter(d => d.id !== id));
    } catch (err) { console.error(err); }
  };

  React.useEffect(() => {
    if (!workspaceId) return;
    fetch(`${apiBase}/api/v1/documents/?workspace_id=${workspaceId}`, { headers: authHeader })
      .then(res => res.json())
      .then(data => setDynamicDocs((Array.isArray(data) ? data : []).map((d: any) => ({ ...d, category: categorize(d.name) }))))
      .catch(err => console.error(err));
  }, [workspaceId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    if (file.type !== "application/pdf") { alert("Please upload .pdf files only!"); return; }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('workspace_id', workspaceId);
      formData.append('file', file);

      const res = await fetch(`${apiBase}/api/v1/documents/upload`, {
        method: "POST",
        headers: authHeader,
        body: formData,
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail || 'Upload failed'); return; }
      const docData = await res.json();
      setDynamicDocs(prev => [{ ...docData, category: categorize(docData.name) }, ...prev]);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const availableCategories = Array.from(new Set(dynamicDocs.map(d => d.category)));
  const tabs = ['All Documents', ...availableCategories.sort()];
  const filteredDocs = dynamicDocs.filter(doc => {
    const matchesTab = activeTab === 'All Documents' || doc.category === activeTab;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // ── Member view: don't show file names — just a summary of what they can ask
  if (!isAdmin) {
    const totalDocs = dynamicDocs.length;
    const categoryCounts: Record<string, number> = {};
    dynamicDocs.forEach(d => { categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1; });

    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0a0a0a] overflow-y-auto">
        <div className="px-10 py-10 border-b border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0a0a0a]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <FolderIcon className="w-8 h-8 text-red-500" /> Knowledge Base
            </h2>
            <p className="text-slate-500 mt-2">An overview of what your AI assistant has access to.</p>
          </div>
        </div>

        <div className="flex-1 p-10">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">Total documents indexed</p>
              <p className="text-5xl font-bold text-slate-900 dark:text-white">{totalDocs}</p>
              <p className="text-slate-500 mt-3 text-sm">You can ask the assistant any questions about the content of these documents.</p>
            </div>

            {Object.keys(categoryCounts).length > 0 && (
              <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4">Available content types</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Object.entries(categoryCounts).map(([cat, count]) => (
                    <div key={cat} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{cat}</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/40 rounded-2xl p-6 text-sm text-slate-700 dark:text-slate-300">
              <p className="font-semibold mb-1">Tip</p>
              <p>Try asking specific questions like &quot;What was the Q4 revenue?&quot; or &quot;Summarize the latest policy update.&quot; The assistant will search across the documents and cite its sources.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0a0a0a] transition-colors overflow-hidden">

      {/* Header */}
      <div className="px-10 py-10 border-b border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <FolderIcon className="w-8 h-8 text-red-500" /> Knowledge Base
            </h2>
            <p className="text-slate-500 mt-2">
              Manage documents that power your enterprise AI.
            </p>
          </div>

          <>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" />
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-xl py-3 px-6 font-semibold transition-all shadow-md disabled:opacity-50">
              <CloudArrowUpIcon className={`w-6 h-6 ${isUploading ? "animate-pulse" : ""}`} />
              {isUploading ? "Uploading & indexing…" : "Upload Document"}
            </button>
          </>
        </div>
        {isUploading && (
          <div className="max-w-6xl mx-auto mt-4">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span><strong>Indexing your document…</strong> This usually takes 10–30 seconds depending on size. Once it&apos;s ready, you&apos;ll be able to ask questions about it.</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-6xl mx-auto flex flex-col h-full">

          {/* Tabs and Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-200 dark:border-slate-800/50 pb-4">

            {/* Horizontal Tabs */}
            <div className="flex items-center overflow-x-auto gap-2 pb-2 md:pb-0 hide-scrollbar pt-2">
               {tabs.map((tab) => (
                 <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-4 py-2 rounded-full font-medium text-[14px] whitespace-nowrap transition-all ${activeTab === tab ? "bg-slate-900 dark:bg-white text-white dark:text-black shadow-md" : "bg-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800"}`}
                 >
                   {tab}
                   {tab === 'All Documents' && <span className={`ml-2 text-xs opacity-70 px-1.5 py-0.5 rounded-md ${activeTab === tab ? 'bg-white/20 dark:bg-black/20' : 'bg-slate-200 dark:bg-slate-800'}`}>{dynamicDocs.length}</span>}
                 </button>
               ))}
            </div>

            {/* Global Search Bar */}
            <div className="relative w-full md:w-80 shrink-0">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search files..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-full py-2.5 pl-11 pr-4 text-[14px] font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-red-500 shadow-sm transition-all"
              />
            </div>

          </div>

          {/* Categorized Documents Grid */}
          <div className="flex-1">
             {filteredDocs.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                 <FolderIcon className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-700" />
                 <p className="text-[15px] font-medium">No documents match your filters.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {filteredDocs.map((doc: any) => (
                   <div key={doc.id} className="flex flex-col bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-red-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                     
                     <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                          <DocumentTextIcon className={`w-5 h-5 ${doc.status === 'READY' ? 'text-red-500' : 'text-amber-500 animate-pulse'}`} />
                        </div>
                        <button 
                          onClick={(e) => handleDeleteDocument(e, doc.id)}
                          className={`text-slate-300 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-all ${!isAdmin ? 'invisible' : ''}`}
                          disabled={!isAdmin}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                     </div>

                     <div className="flex flex-col flex-1">
                       <span className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-slate-100 line-clamp-1" title={doc.name}>{doc.name}</span>
                       <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mt-1">{doc.category}</span>
                       <div className="flex items-center justify-between mt-4">
                         <span className="text-[11px] font-medium text-slate-500">{doc.size}</span>
                         <span className={`text-[9px] uppercase font-bold tracking-widest rounded-md px-2 py-1 ${doc.status === 'READY' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm' : 'bg-amber-100 text-amber-700'}`}>
                           {doc.status}
                         </span>
                       </div>
                     </div>

                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

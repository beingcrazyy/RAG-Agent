"use client";

import React, { useState } from 'react';
import { FolderIcon, DocumentTextIcon, CloudArrowUpIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/solid';

export default function DocumentManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dynamicDocs, setDynamicDocs] = useState<any[]>([]);

  // Tab State
  const [activeTab, setActiveTab] = useState<string>('All Documents');

  const handleDeleteDocument = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
      await fetch(`${apiBase}/api/v1/documents/${id}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer mock-token" }
      });
      setDynamicDocs(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${apiBase}/api/v1/documents/`, {
      headers: { "Authorization": "Bearer mock-token" }
    })
    .then(res => res.json())
    .then(data => {
      // Map strictly by true extensions
      const categorized = data.map((d: any) => {
        let cat = 'Other Formats';
        const raw = d.name.toLowerCase();
        
        if (raw.endsWith('.pdf')) cat = 'PDF Documents';
        else if (raw.endsWith('.jpg') || raw.endsWith('.jpeg') || raw.endsWith('.png') || raw.endsWith('.svg')) cat = 'Image Assets';
        else if (raw.endsWith('.xls') || raw.endsWith('.xlsx') || raw.endsWith('.csv')) cat = 'Spreadsheets';
        else if (raw.endsWith('.doc') || raw.endsWith('.docx') || raw.endsWith('.txt')) cat = 'Text Documents';

        return { ...d, category: cat };
      });
      setDynamicDocs(categorized);
    })
    .catch(err => console.error(err));
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload standard .pdf files for the initial test phase!");
      return;
    }

    setIsUploading(true);
    const mockWs = "00000000-0000-0000-0000-000000000000";
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const createRes = await fetch(`${apiBase}/api/v1/documents/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-token"
        },
        body: JSON.stringify({ workspace_id: mockWs, filename: file.name })
      });
      const docData = await createRes.json();
      const docId = docData.id;

      let targetCat = 'Other Formats';
      const raw = file.name.toLowerCase();
      if (raw.endsWith('.pdf')) targetCat = 'PDF Documents';
      else if (raw.endsWith('.jpg') || raw.endsWith('.jpeg') || raw.endsWith('.png') || raw.endsWith('.svg')) targetCat = 'Image Assets';
      else if (raw.endsWith('.xls') || raw.endsWith('.xlsx') || raw.endsWith('.csv')) targetCat = 'Spreadsheets';
      else if (raw.endsWith('.doc') || raw.endsWith('.docx') || raw.endsWith('.txt')) targetCat = 'Text Documents';

      setDynamicDocs(prev => [{
        id: docId,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        status: "UPLOADING",
        category: targetCat
      }, ...prev]);

      const urlRes = await fetch(`${apiBase}/api/v1/documents/${docId}/upload-url`, {
        headers: { "Authorization": "Bearer mock-token" }
      });
      const urlData = await urlRes.json();
      let uploadUrl = urlData.upload_url;

      if (uploadUrl.includes("gcs-emulator")) {
        uploadUrl = uploadUrl.replace("gcs-emulator:4443", "localhost:4443");
      }

      const method = uploadUrl.includes("uploadType=media") ? "POST" : "PUT";
      await fetch(uploadUrl, {
        method: method,
        body: file,
        headers: { "Content-Type": file.type }
      });

      setDynamicDocs(prev => prev.map(d => d.id === docId ? { ...d, status: "PROCESSING" } : d));
      await fetch(`${apiBase}/api/v1/documents/${docId}/process`, {
        method: "POST",
        headers: { "Authorization": "Bearer mock-token" }
      });

      setTimeout(() => {
        setDynamicDocs(prev => prev.map(d => d.id === docId ? { ...d, status: "READY" } : d));
      }, 3000);

    } catch (err: any) {
      alert("Upload failed! " + err.message);
      setDynamicDocs(prev => prev.filter(d => d.name !== file.name));
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Derive Tabs (All + Active dynamic categories found in docs)
  const availableCategories = Array.from(new Set(dynamicDocs.map(d => d.category)));
  const tabs = ['All Documents', ...availableCategories.sort()];

  // Filter Logic: Active Tab AND Search Query
  const filteredDocs = dynamicDocs.filter(doc => {
    const matchesTab = activeTab === 'All Documents' || doc.category === activeTab;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0a0a0a] transition-colors overflow-hidden">
      
      {/* Header View */}
      <div className="px-10 py-10 border-b border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
               <FolderIcon className="w-8 h-8 text-red-500" /> Knowledge Base
            </h2>
            <p className="text-slate-500 mt-2">Manage the foundational document arrays your Workspace AI relies on.</p>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="application/pdf"
          />
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-xl py-3 px-6 font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            <CloudArrowUpIcon className={`w-6 h-6 ${isUploading ? "animate-pulse" : ""}`} />
            <span>{isUploading ? "Uploading..." : "Upload Document"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-6xl mx-auto flex flex-col h-full">
          
          {/* Top Controls: Tabs and Search */}
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
                          className="text-slate-300 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-all"
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

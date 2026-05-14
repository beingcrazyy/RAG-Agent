"use client";

import React, { useState } from 'react';
import { FolderIcon, DocumentTextIcon, CloudArrowUpIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon as DocumentTextIconSolid } from '@heroicons/react/24/solid';
import type { AuthUser } from '../app/page';

export default function DocumentManager({ user }: { user: AuthUser }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const authHeader = { "Authorization": `Bearer ${user?.access_token}` };
  const workspaceId = user?.workspace_id;
  const isAdmin = user?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDocName, setUploadDocName] = useState('');
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
    setUploadProgress(0);
    setUploadDocName(file.name);

    try {
      const formData = new FormData();
      formData.append('workspace_id', workspaceId);
      formData.append('file', file);

      const res = await fetch(`${apiBase}/api/v1/documents/upload`, {
        method: "POST",
        headers: authHeader,
        body: formData,
      });
      if (!res.ok) { const err = await res.json(); alert(err.detail || 'Upload failed'); return; }
      const docData = await res.json();

      // Poll progress until document is READY or FAILED
      const pollProgress = async () => {
        const statusRes = await fetch(`${apiBase}/api/v1/documents/${docData.id}/status`, { headers: authHeader });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setUploadProgress(statusData.progress);
          if (statusData.status === 'READY') {
            setDynamicDocs(prev => [{ ...statusData, category: categorize(statusData.name) }, ...prev]);
            setIsUploading(false);
          } else if (statusData.status === 'FAILED') {
            setIsUploading(false);
            alert('Document processing failed. Please try again.');
          } else {
            setTimeout(pollProgress, 1000);
          }
        } else {
          setTimeout(pollProgress, 1000);
        }
      };
      pollProgress();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
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

  if (!isAdmin) {
    const totalDocs = dynamicDocs.length;
    const categoryCounts: Record<string, number> = {};
    dynamicDocs.forEach(d => { categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1; });

    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
        <div className="px-10 py-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <DocumentTextIcon className="w-8 h-8" style={{ color: '#3b82f6' }} /> Knowledge Base
            </h2>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>An overview of what your AI assistant has access to.</p>
          </div>
        </div>

        <div className="flex-1 p-10">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="rounded-3xl p-8" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Total documents indexed</p>
              <p className="text-5xl font-bold" style={{ color: 'var(--text)' }}>{totalDocs}</p>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>You can ask the assistant any questions about the content of these documents.</p>
            </div>

            {Object.keys(categoryCounts).length > 0 && (
              <div className="rounded-3xl p-8" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text)' }}>Available content types</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(categoryCounts).map(([cat, count]) => (
                    <div key={cat} className="rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{cat}</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl p-5 text-sm" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', color: 'var(--text-secondary)' }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Tip</p>
              <p>Try asking specific questions like &quot;What was the Q4 revenue?&quot; or &quot;Summarize the latest policy update.&quot; The assistant will search across the documents and cite its sources.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div className="px-10 py-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text)' }}>
              <DocumentTextIcon className="w-8 h-8" style={{ color: '#3b82f6' }} /> Knowledge Base
            </h2>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
              Manage documents that power your enterprise AI.
            </p>
          </div>

          <>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" />
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="flex items-center gap-2 text-white rounded-2xl py-3 px-6 font-semibold transition-all shadow-lg disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
              <CloudArrowUpIcon className={`w-5 h-5 ${isUploading ? "animate-pulse" : ""}`} />
              {isUploading ? "Uploading & indexing…" : "Upload Document"}
            </button>
          </>
        </div>
        {isUploading && (
          <div className="max-w-6xl mx-auto mt-4">
            <div className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{uploadDocName}</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: '#3b82f6' }}>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-10" style={{ background: 'var(--bg)' }}>
        <div className="max-w-6xl mx-auto flex flex-col h-full">

          {/* Tabs and Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center overflow-x-auto gap-2 hide-scrollbar">
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 rounded-full font-medium text-[14px] whitespace-nowrap transition-all"
                  style={activeTab === tab
                    ? { background: '#3b82f6', color: '#fff', boxShadow: '0 2px 6px rgba(59,130,246,0.2)' }
                    : { color: 'var(--text-secondary)', background: 'transparent' }
                  }>
                  {tab}
                  {tab === 'All Documents' && <span className="ml-2 text-xs opacity-70">{dynamicDocs.length}</span>}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72 shrink-0">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search files…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl py-2.5 pl-11 pr-4 text-[14px] font-medium outline-none transition-all"
                style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          {/* Documents Grid */}
          <div className="flex-1">
            {filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
                <FolderIcon className="w-12 h-12 mb-4 opacity-40" />
                <p className="text-[15px] font-medium">No documents match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocs.map((doc: any) => (
                  <div key={doc.id} className="flex flex-col rounded-3xl p-5 group transition-all"
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}>

                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)' }}>
                        <DocumentTextIconSolid className={`w-5 h-5 ${doc.status === 'READY' ? 'text-blue-500' : 'text-amber-500 animate-pulse'}`} />
                      </div>
                      <button
                        onClick={(e) => handleDeleteDocument(e, doc.id)}
                        className="p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                        style={{ background: 'var(--surface-hover)' }}>
                        <TrashIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </div>

                    <div className="flex flex-col flex-1">
                      <span className="font-semibold text-[15px] tracking-tight line-clamp-1" style={{ color: 'var(--text)' }} title={doc.name}>{doc.name}</span>
                      <span className="text-[11px] font-medium uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>{doc.category}</span>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{doc.size}</span>
                        <span className="text-[9px] uppercase font-bold tracking-widest rounded-lg px-2 py-1"
                          style={doc.status === 'READY' ? { background: 'rgba(59,130,246,0.08)', color: '#3b82f6' } : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
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

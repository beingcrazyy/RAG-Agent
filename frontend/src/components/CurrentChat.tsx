"use client";

import React, { useState } from 'react';
import { PaperAirplaneIcon, DocumentTextIcon, HashtagIcon } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Hover-to-reveal Sources button
function SourcesPopover({ sources }: { sources: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block mt-3">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-800/50 bg-white dark:bg-[#111]"
      >
        <DocumentTextIcon className="w-3.5 h-3.5" />
        <span>View Sources ({sources.length})</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 z-50 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 min-w-[260px] max-w-[340px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Retrieved Sources</p>
            <ul className="flex flex-col gap-1.5">
              {sources.map((src, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1 shrink-0" />
                  {src}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CurrentChat({ activeThreadId, user }: { activeThreadId: string | null, user: any }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const authHeader = { "Authorization": `Bearer ${user?.access_token}`, "Content-Type": "application/json" };
  const workspaceId = user?.workspace_id;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadName, setThreadName] = useState<string>("New Chat");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");

  const fetchActiveThreadName = () => {
    if (!activeThreadId || !workspaceId) return;
    fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, {
      headers: authHeader
    })
    .then(res => res.json())
    .then(data => {
      const active = Array.isArray(data) ? data.find((t: any) => t.id === activeThreadId) : null;
      if (active) setThreadName(active.title);
    })
    .catch();
  };

  React.useEffect(() => {
    if (!activeThreadId) {
      setThreadName("New Chat");
      setMessages([{
        id: 1,
        role: 'assistant',
        content: 'Select a thread to continue chatting, or click "+ New Chat" in the sidebar to begin.',
      }]);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetchActiveThreadName();

    fetch(`${apiBase}/api/v1/chat/${activeThreadId}/messages`, {
      headers: authHeader
    })
    .then(res => res.json())
    .then(data => {
      if (!data || data.length === 0) {
        setMessages([{
          id: 1,
          role: 'assistant',
          content: 'Hello! I am Loomind. I have full access to your uploaded documents. How can I help you today?',
        }]);
      } else {
        // Parse stored messages: extract sources from persisted |SOURCES:...| strings
        const parsed = data.map((m: any) => {
          if (m.role === 'assistant' && m.content.includes('|SOURCES:')) {
            const [text, tail] = m.content.split('|SOURCES:');
            const srcList = tail.replace(/\|$/, '').split(',').filter(Boolean);
            return { ...m, content: text, sources: srcList };
          }
          return m;
        });
        setMessages(parsed);
      }
    })
    .catch(err => console.error(err));
  }, [activeThreadId]);

  const handleSend = async () => {
    if (!inputValue.trim() || !activeThreadId) return;
    
    const prompt = inputValue;
    setInputValue('');
    setIsTyping(true);

    const now = Date.now();
    const tempUserId = `user-${now}`;
    const tempAssistantId = `assist-${now}`;

    setMessages((prev: any[]) => [
      ...prev, 
      { id: tempUserId, role: 'user', content: prompt },
      { id: tempAssistantId, role: 'assistant', content: '', isSearching: false }
    ]);

    try {
      const res = await fetch(`${apiBase}/api/v1/chat/`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          workspace_id: workspaceId,
          thread_id: activeThreadId,
          message: prompt
        })
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setIsTyping(false);

      // Persistent state across read() iterations
      let buffer = '';
      let isSearching = false;
      let foundSignalReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Phase 1: SEARCHING — show overlay (fires once)
        if (!foundSignalReceived && buffer.includes('[SYS:SEARCHING]')) {
          isSearching = true;
        }
        
        // Phase 2: FOUND — collapse overlay permanently
        if (!foundSignalReceived && buffer.includes('[SYS:FOUND]')) {
          isSearching = false;
          foundSignalReceived = true;
        }

        // Strip system signals and flush padding from visible text
        let cleanText = buffer;
        cleanText = cleanText.replace(/\[SYS:SEARCHING\][^|]*\|[ ]*/g, '');
        cleanText = cleanText.replace(/\[SYS:FOUND\]\|/g, '');
        // Strip the LLM-appended [[USED:...]] citation marker from displayed text
        cleanText = cleanText.replace(/\s*\[\[USED:[\s\S]*?\]\]/g, '');

        // Extract sources from the stream if present
        let displayText = cleanText;
        let sources: string[] = [];
        if (cleanText.includes('|SOURCES:')) {
          const [txt, tail] = cleanText.split('|SOURCES:');
          displayText = txt;
          sources = tail.replace(/\|$/, '').split(',').filter(Boolean);
        }

        setMessages((prev: any[]) => prev.map((msg: any) => 
          msg.id === tempAssistantId 
            ? { ...msg, content: displayText, isSearching, sources }
            : msg
        ));
      }

      // Stream done — ensure overlay collapsed
      setMessages((prev: any[]) => prev.map((msg: any) => 
        msg.id === tempAssistantId ? { ...msg, isSearching: false } : msg
      ));

      fetchActiveThreadName();
      window.dispatchEvent(new Event('chat_threads_updated'));

    } catch (e: any) {
      setIsTyping(false);
      setMessages((prev: any[]) => prev.map((msg: any) => 
        msg.id === tempAssistantId ? { ...msg, content: `Error: ${e.message}`, isSearching: false } : msg
      ));
    }
  };

  const handleRenameSubmit = async () => {
    if (!editTitleValue.trim() || !activeThreadId) {
      setIsEditingTitle(false);
      return;
    }
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
      await fetch(`${apiBase}/api/v1/chat/threads/${activeThreadId}/rename`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ title: editTitleValue.trim() })
      });
      setThreadName(editTitleValue.trim());
      window.dispatchEvent(new Event('chat_threads_updated'));
    } catch(e) { console.error(e); }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex-1 flex flex-col relative bg-white dark:bg-[#0a0a0a] transition-colors">
      
      {/* Thread Header */}
      {activeThreadId && (
        <div className="w-full flex items-center gap-2 px-8 py-5 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-[#0a0a0a] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] relative z-20 group">
          <HashtagIcon className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
          
          {isEditingTitle ? (
            <input 
              autoFocus
              className="bg-transparent border-b border-red-500 text-lg font-bold text-slate-900 dark:text-slate-100 outline-none w-1/2"
              value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            />
          ) : (
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => { setIsEditingTitle(true); setEditTitleValue(threadName); }}
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">{threadName}</h2>
              <svg className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Chat Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 relative z-10 transition-colors">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
          {messages.map((msg) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={clsx(
                "flex gap-3 w-full",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row items-start"
              )}
            >
              {/* Loomind Logo — vertically aligned with first line of text */}
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center overflow-hidden bg-transparent mt-1">
                  <img src="/logo.png" className="w-full h-full object-cover" alt="Loomind" />
                </div>
              )}

              {/* Message content + sources */}
              <div className={clsx(
                "flex flex-col max-w-[85%]",
                msg.role === 'user' ? "items-end" : "items-start"
              )}>
                {/* Bubble */}
                <div className={clsx(
                  "relative break-words",
                  msg.role === 'user'
                    ? "bg-slate-100 dark:bg-[#1a1a1a] text-slate-900 dark:text-slate-100 rounded-[20px] rounded-tr-[4px] px-5 py-3.5"
                    : "text-slate-800 dark:text-slate-200"
                )}>
                  {msg.role === 'user' ? (
                    <p className="leading-relaxed text-[15px] whitespace-pre-wrap font-medium">{msg.content}</p>
                  ) : (
                    <>
                      {/* Searching overlay — simple gray, no doc names */}
                      <AnimatePresence>
                        {msg.isSearching && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[13px] mb-3"
                          >
                            <span className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <span
                                  key={i}
                                  className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce"
                                  style={{ animationDelay: `${i * 120}ms` }}
                                />
                              ))}
                            </span>
                            <span>Searching in database...</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          ul: ({...props}) => <ul className="list-disc pl-5 mt-2 space-y-1.5" {...props} />,
                          ol: ({...props}) => <ol className="list-decimal pl-5 mt-2 space-y-1.5" {...props} />,
                          li: ({...props}) => <li className="text-[15px] leading-relaxed" {...props} />,
                          p: ({...props}) => <p className="leading-relaxed text-[15px] mb-3 last:mb-0" {...props} />,
                          strong: ({...props}) => <strong className="font-semibold text-black dark:text-white" {...props} />,
                          table: ({...props}) => <div className="overflow-x-auto mt-4 border border-slate-200 dark:border-slate-800 rounded-lg"><table className="w-full text-left text-sm" {...props} /></div>,
                          thead: ({...props}) => <thead className="bg-slate-50 dark:bg-[#111]" {...props} />,
                          th: ({...props}) => <th className="p-3 font-semibold text-slate-900 dark:text-slate-100" {...props} />,
                          td: ({...props}) => <td className="p-3 border-t border-slate-200 dark:border-slate-800" {...props} />,
                        }}
                      >
                        {msg.content || ''}
                      </ReactMarkdown>
                    </>
                  )}
                </div>

                {/* Sources hover button — only on assistant messages with sources */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <SourcesPopover sources={msg.sources} />
                )}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden mt-1">
                <img src="/logo.png" className="w-full h-full object-cover" alt="Loomind" />
              </div>
              <div className="flex items-center gap-1 px-1 pt-2">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Bar */}
      <div className="px-6 py-4 pb-8 relative z-10 w-full flex justify-center mt-auto">
        <div className="w-full max-w-3xl relative">
          <input
            autoFocus
            type="text"
            value={inputValue}
            disabled={!activeThreadId}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={activeThreadId ? "Ask anything about your documents..." : "Select or create a thread to chat..."}
            className="w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-full pl-6 pr-16 py-[18px] text-[15px] font-medium text-slate-900 dark:text-white placeholder-slate-400 shadow-[0_10px_40px_rgba(0,0,0,0.04)] focus:shadow-[0_10px_40px_rgba(239,68,68,0.08)] focus:border-red-400/60 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || !activeThreadId}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20 disabled:opacity-40 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-all"
          >
            <PaperAirplaneIcon className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>

    </div>
  );
}

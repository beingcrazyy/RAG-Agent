"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import { PaperAirplaneIcon, DocumentDuplicateIcon } from '@heroicons/react/24/solid';

export default function CurrentChat({ activeThreadId, user }: { activeThreadId: string | null; user?: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadName, setThreadName] = useState('New Chat');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [suggestions, setSuggestions] = useState<{questions: string[]; summaries: {name:string;summary:string}[]; doc_count: number}>({questions:[], summaries:[], doc_count:0});
  const [showSuggestions, setShowSuggestions] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const authHeader = { "Authorization": `Bearer ${user?.access_token}` };
  const workspaceId = user?.workspace_id;

  const assistantLogoSrc = user?.logo_url ? `${apiBase}${user.logo_url}` : '/logo.png';
  const assistantName = user?.enterprise_name || 'Loomind';

  useEffect(() => {
    if (activeThreadId) {
      fetch(`${apiBase}/api/v1/chat/threads/${activeThreadId}/messages`, { headers: authHeader })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setMessages(data);
          } else {
            setMessages([{ id: 'welcome', role: 'assistant', content: `Hi! I'm your ${assistantName} AI assistant. I can answer questions based on your knowledge base. What would you like to know?` }]);
          }
        });
      fetch(`${apiBase}/api/v1/chat/threads/${activeThreadId}`, { headers: authHeader })
        .then(r => r.json())
        .then(data => {
          if (data && data.title) { setThreadName(data.title); setEditTitleValue(data.title); }
        });
    } else {
      setMessages([{ id: 'welcome', role: 'assistant', content: `Hi! I'm your ${assistantName} AI assistant. I can answer questions based on your knowledge base. What would you like to know?` }]);
      setThreadName('New Chat');
    }
  }, [activeThreadId]);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`${apiBase}/api/v1/documents/suggestions?workspace_id=${workspaceId}`, { headers: authHeader })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSuggestions(data); })
      .catch(() => {});
  }, [workspaceId]);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim() || !activeThreadId) return;
    const prompt = inputValue.trim();
    setInputValue('');
    setIsTyping(true);
    setShowSuggestions(false);

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
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ query: prompt, thread_id: activeThreadId })
      });

      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = "";

      setIsTyping(false);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (let line of lines) {
            line = line.trim();
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.status === 'searching') {
                  setMessages(prev => prev.map(m => m.id === tempAssistantId ? { ...m, isSearching: true } : m));
                } else if (parsed.status === 'chunk') {
                  fullResponse += parsed.content;
                  setMessages(prev => prev.map(m => m.id === tempAssistantId ? { ...m, content: fullResponse, isSearching: false } : m));
                }
              } catch (e) {
                 // ignore mid-stream chunk parse errors depending on server payload
              }
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === tempAssistantId ? { ...m, content: "Sorry, I encountered an error communicating with the server." } : m));
      setIsTyping(false);
    }
  };

  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    if (editTitleValue.trim() !== threadName && activeThreadId) {
      await fetch(`${apiBase}/api/v1/chat/threads/${activeThreadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ title: editTitleValue.trim() })
      });
      setThreadName(editTitleValue.trim());
      window.dispatchEvent(new Event('chat_threads_updated'));
    }
  };

  // Custom Markdown Renderers for ReactMarkdown
  const CustomMarkdown = ({ content }: { content: string }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="w-full text-sm text-left align-middle border-collapse" {...props} /></div>,
        th: ({node, ...props}) => <th className="px-4 py-3 bg-[var(--color-light-sidebar)] dark:bg-[var(--color-dark-sidebar)] border border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] font-semibold text-[var(--color-light-text-primary)] dark:text-[var(--color-dark-text-primary)] relative whitespace-nowrap" {...props} />,
        td: ({node, ...props}) => <td className="px-4 py-3 border border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] shadow-[0_1px_0_rgba(255,255,255,0.1)_inset]" {...props} />,
        a: ({node, ...props}) => <a className="text-[var(--color-brand-primary)] dark:text-[var(--color-brand-accent)] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
        code: ({node, className, children, ...props}: any) => {
          const match = /language-(\w+)/.exec(className || '')
          return match ? (
            <div className="rounded-lg overflow-hidden my-4 border border-[var(--color-light-border)] dark:border-[var(--color-dark-border)]">
              <div className="bg-[var(--color-light-sidebar)] dark:bg-[#151821] px-4 py-1.5 text-xs text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] uppercase tracking-wider font-semibold border-b border-[var(--color-light-border)] dark:border-[var(--color-dark-border)]">
                {match[1]}
              </div>
              <pre className="p-4 bg-[var(--color-light-bg)] dark:bg-[#0a0a0a] overflow-x-auto text-[13px] leading-relaxed">
                <code className={className} {...props}>{children}</code>
              </pre>
            </div>
          ) : (
            <code className="bg-[var(--color-light-sidebar)] dark:bg-[var(--color-dark-cards)] border border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] px-1.5 py-0.5 rounded text-[0.9em] font-mono" {...props}>{children}</code>
          )
        },
        h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-6 mb-2 text-[var(--color-light-text-primary)] dark:text-white tracking-tight" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-5 mb-2 text-[var(--color-light-text-primary)] dark:text-white tracking-tight" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-4 mb-2 text-[var(--color-light-text-primary)] dark:text-white" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc leading-relaxed my-3 pl-5 space-y-1.5" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal leading-relaxed my-3 pl-5 space-y-1.5" {...props} />,
        li: ({node, ...props}) => <li className="marker:text-slate-400 pl-1" {...props} />,
        p: ({node, ...props}) => <p className="mb-3 leading-[1.7] last:mb-0" {...props} />,
        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[var(--color-brand-primary)] pl-4 italic text-slate-600 dark:text-slate-400 my-4 bg-slate-50 dark:bg-slate-800/30 py-2 pr-2" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-light-bg)] dark:bg-[var(--color-dark-bg)] shadow-[inset_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.02)] relative min-w-0">
      
      {/* Header */}
      {!activeThreadId ? (
        <div className="px-6 py-5 border-b border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-light-bg)] dark:bg-[var(--color-dark-bg)]/80 backdrop-blur-md sticky top-0 z-20 flex justify-between items-center transition-colors">
          <h2 className="text-lg font-bold text-[var(--color-light-text-primary)] dark:text-white tracking-tight">New Chat</h2>
        </div>
      ) : (
        <div className="px-6 py-5 border-b border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-light-bg)] dark:bg-[var(--color-dark-bg)]/80 backdrop-blur-md sticky top-0 z-20 transition-colors">
          {isEditingTitle ? (
            <input 
              autoFocus
              type="text" 
              value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              className="text-lg font-bold bg-transparent outline-none border-b-2 border-[var(--color-brand-primary)] text-[var(--color-light-text-primary)] dark:text-white w-full max-w-md pb-1 tracking-tight"
            />
          ) : (
            <div 
              className="group flex items-center gap-3 cursor-pointer w-fit"
              onClick={() => { setIsEditingTitle(true); setEditTitleValue(threadName); }}
            >
              <h2 className="text-lg font-bold text-[var(--color-light-text-primary)] dark:text-white tracking-tight">{threadName}</h2>
              <svg className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Chat Scroll Area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-8 relative z-10 transition-colors scrollbar-thin">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {messages.map((msg, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={clsx(
                "flex gap-3 w-full",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row items-start"
              )}
            >
              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--color-light-sidebar)] dark:bg-[var(--color-dark-sidebar)] border border-[var(--color-light-border)] dark:border-[var(--color-dark-border)] text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] flex items-center justify-center text-xs font-bold shadow-sm">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              
              {/* Assistant Logo */}
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm bg-white">
                  <img src={assistantLogoSrc} className="w-full h-full object-contain p-1" alt={assistantName} />
                </div>
              )}
              
              {/* Chat Bubble */}
              <div className={clsx(
                "max-w-[85%] text-[15px] leading-[1.65]",
                msg.role === 'user' 
                  ? "bg-[#111827] text-white rounded-[18px] rounded-tr-sm px-5 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-none" 
                  : "bg-[#F9FAFB] dark:bg-[var(--color-dark-cards)] text-[var(--color-light-text-primary)] dark:text-white rounded-[18px] rounded-tl-sm px-5 py-4 border border-[#ECECEC] dark:border-[var(--color-dark-border)] shadow-sm whitespace-pre-wrap"
              )}>
                {msg.isSearching ? (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <DocumentDuplicateIcon className="w-4 h-4 animate-pulse" />
                    <span className="text-sm font-medium">Searching knowledge base...</span>
                  </div>
                ) : (
                  msg.role === 'assistant' ? <CustomMarkdown content={msg.content} /> : msg.content
                )}
              </div>
            </motion.div>
          ))}

          {/* Intelligent Empty State (Pills and Summaries) */}
          {messages.length === 1 && showSuggestions && (suggestions.questions.length > 0 || suggestions.summaries.length > 0) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-12 mt-2 space-y-6 max-w-[80%]">
              
              {suggestions.summaries.length > 0 && (
                <div>
                  <p className="text-[12px] uppercase tracking-widest text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] font-bold mb-3">What you can ask about</p>
                  <div className="space-y-2 text-[14.5px] text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)]">
                    {suggestions.summaries.slice(0, 4).map((s, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-[var(--color-brand-primary)] mt-0.5">•</span>
                        <span className="leading-relaxed">{s.summary}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.questions.length > 0 && (
                <div>
                  <p className="text-[12px] uppercase tracking-widest text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] font-bold mb-3">Try one of these</p>
                  <div className="flex flex-wrap gap-2.5">
                    {suggestions.questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { setInputValue(q); document.getElementById('chat-input')?.focus(); }}
                        className="px-4 py-2.5 rounded-full border border-[#E5E7EB] dark:border-[var(--color-dark-border)] bg-white dark:bg-[var(--color-dark-bg)] text-[14px] text-[var(--color-light-text-primary)] dark:text-[var(--color-dark-text-primary)] shadow-sm hover:border-[var(--color-brand-primary)] dark:hover:border-[var(--color-brand-accent)] hover:text-[var(--color-brand-primary)] dark:hover:text-[var(--color-brand-accent)] transition-all font-medium"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 items-start w-full">
              <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm bg-white">
                <img src={assistantLogoSrc} className="w-full h-full object-contain p-1" alt={assistantName} />
              </div>
              <div className="bg-[#F9FAFB] dark:bg-[var(--color-dark-cards)] border border-[#ECECEC] dark:border-[var(--color-dark-border)] rounded-[18px] rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1.5 h-[50px]">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 pb-8 relative z-10 w-full flex justify-center mt-auto bg-gradient-to-t from-[var(--color-light-bg)] via-[var(--color-light-bg)] to-transparent dark:from-[var(--color-dark-bg)] dark:via-[var(--color-dark-bg)]">
        <div className="max-w-3xl w-full relative">
          <div className="relative flex items-end">
            <textarea
              id="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleSend(); 
                } 
              }}
              placeholder={`Ask ${assistantName} anything...`}
              className="w-full glass-input rounded-[20px] pt-4 pb-4 pl-5 pr-14 text-[15px] resize-none h-[100px] text-[var(--color-light-text-primary)] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none focus:border-[var(--color-brand-primary)] focus:ring-[3px] focus:ring-[var(--color-brand-primary)]/10 dark:focus:ring-[var(--color-brand-accent)]/20 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="absolute right-3 bottom-3 p-2.5 rounded-full bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)] text-white disabled:opacity-40 disabled:hover:bg-[var(--color-brand-primary)] transition-all shadow-sm"
              title="Send (Enter)"
            >
              <PaperAirplaneIcon className="w-5 h-5 -rotate-45 -mt-0.5" />
            </button>
          </div>
          <div className="text-center mt-3 text-[11px] text-slate-400 font-medium">
            AI can make mistakes. Verify important information.
          </div>
        </div>
      </div>
    </div>
  );
}
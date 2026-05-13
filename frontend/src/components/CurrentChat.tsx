"use client";

import React, { useState } from 'react';
import { PaperAirplaneIcon, HashtagIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon as DocumentTextIconSolid } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function SourcesPopover({ sources }: { sources: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block mt-3">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-xl transition-all"
        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#3b82f6' }}
      >
        <DocumentTextIconSolid className="w-3.5 h-3.5" />
        <span>Sources ({sources.length})</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 z-50 rounded-2xl p-4 min-w-[280px] max-w-[360px]"
            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Retrieved Sources</p>
            <ul className="flex flex-col gap-2">
              {sources.map((src, i) => (
                <li key={i} className="flex items-start gap-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-4 h-4 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    {i + 1}
                  </span>
                  <span>{src}</span>
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
  const assistantLogoSrc = user?.logo_url ? `${apiBase}${user.logo_url}` : '/logo.png';
  const assistantName = user?.enterprise_name || 'Loomind';

  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadName, setThreadName] = useState<string>("New Chat");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [suggestions, setSuggestions] = useState<{ questions: string[]; summaries: { name: string; summary: string }[]; doc_count: number }>({ questions: [], summaries: [], doc_count: 0 });
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [capabilitiesText, setCapabilitiesText] = useState('');
  const [aiFollowUpQuestions, setAiFollowUpQuestions] = useState<string[]>([]);
  const [logoVersion, setLogoVersion] = useState(0);
  const lastProcessedMessageId = React.useRef<string>('');

  React.useEffect(() => {
    if (!workspaceId) return;
    fetch(`${apiBase}/api/v1/documents/suggestions?workspace_id=${workspaceId}`, { headers: authHeader })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSuggestions(data); })
      .catch(() => { });
  }, [workspaceId]);

  // Bump logo version when user updates (logo/name change in settings)
  React.useEffect(() => {
    const handleUpdate = () => setLogoVersion(v => v + 1);
    window.addEventListener('loomind_user_updated', handleUpdate);
    return () => window.removeEventListener('loomind_user_updated', handleUpdate);
  }, []);

  const fetchActiveThreadName = () => {
    if (!activeThreadId || !workspaceId) return;
    fetch(`${apiBase}/api/v1/chat/threads?workspace_id=${workspaceId}`, { headers: authHeader })
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
      setMessages([{ id: 1, role: 'assistant', content: 'Select a thread to continue chatting, or click "+ New Chat" in the sidebar.' }]);
      return;
    }
    fetchActiveThreadName();
    fetch(`${apiBase}/api/v1/chat/${activeThreadId}/messages`, { headers: authHeader })
      .then(res => res.json())
      .then(data => {
        if (!data || data.length === 0) {
          setMessages([{ id: 1, role: 'assistant', content: `Hi! I'm your ${user?.enterprise_name || 'company'} AI assistant. Ask me anything about your documents.` }]);
        } else {
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
        body: JSON.stringify({ workspace_id: workspaceId, thread_id: activeThreadId, message: prompt })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error: ${res.status} - ${errText || res.statusText}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setIsTyping(false);

      let buffer = '';
      let isSearching = false;
      let foundSignalReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        if (!foundSignalReceived && buffer.includes('[SYS:SEARCHING]')) isSearching = true;
        if (!foundSignalReceived && buffer.includes('[SYS:FOUND]')) { isSearching = false; foundSignalReceived = true; }

        let cleanText = buffer.replace(/\[SYS:SEARCHING\][^|]*\|[ ]*/g, '').replace(/\[SYS:FOUND\]\|/g, '');
        cleanText = cleanText.replace(/\s*\[\[USED:[\s\S]*?\]\]/g, '');

        let displayText = cleanText;
        let sources: string[] = [];
        if (cleanText.includes('|SOURCES:')) {
          const [txt, tail] = cleanText.split('|SOURCES:');
          displayText = txt;
          sources = tail.replace(/\|$/, '').split(',').filter(Boolean);
        }

        setMessages((prev: any[]) => prev.map((msg: any) =>
          msg.id === tempAssistantId ? { ...msg, content: displayText, isSearching, sources } : msg
        ));
      }

      setMessages((prev: any[]) => prev.map((msg: any) =>
        msg.id === tempAssistantId ? { ...msg, isSearching: false } : msg
      ));
      fetchActiveThreadName();
      window.dispatchEvent(new Event('chat_threads_updated'));

    } catch (e: any) {
      setIsTyping(false);
      const errorMsg = e.name === 'TypeError' && e.message === 'Failed to fetch'
        ? 'Unable to connect to server. Please check your connection and try again.'
        : `Error: ${e.message}`;
      setMessages((prev: any[]) => prev.map((msg: any) =>
        msg.id === tempAssistantId ? { ...msg, content: errorMsg, isSearching: false } : msg
      ));
    }
  };

  const handleRenameSubmit = async () => {
    if (!editTitleValue.trim() || !activeThreadId) { setIsEditingTitle(false); return; }
    try {
      await fetch(`${apiBase}/api/v1/chat/threads/${activeThreadId}/rename`, {
        method: 'PUT', headers: authHeader, body: JSON.stringify({ title: editTitleValue.trim() })
      });
      setThreadName(editTitleValue.trim());
      window.dispatchEvent(new Event('chat_threads_updated'));
    } catch (e) { console.error(e); }
    setIsEditingTitle(false);
  };

  const handleHowCanYouHelpMe = () => {
    const docSummaries = suggestions.summaries.map(s => `- ${s.summary}`).join('\n');
    const generalCapabilities = `- Answer questions about your uploaded documents\n- Summarize and extract key information from documents\n- Search across all your knowledge base\n- Help with analysis and insights from your data\n- Answer general questions and assist with tasks`;

    const capabilities = suggestions.doc_count > 0
      ? `I can help you in several ways:\n\n**With Your Documents:**\n${docSummaries}\n\n**General Capabilities:**\n${generalCapabilities}`
      : `I can help you in several ways:\n\n${generalCapabilities}\n\n*Note: Upload documents to enable document-specific assistance.*`;

    setCapabilitiesText(capabilities);
    setShowCapabilities(true);
    setInputValue('');
  };

  const generateFollowUpQuestions = async (lastUserMessage: string, lastAssistantResponse: string) => {
    if (!activeThreadId || !workspaceId) return;
    try {
      const res = await fetch(`${apiBase}/api/v1/chat/follow-up-questions`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          workspace_id: workspaceId,
          thread_id: activeThreadId,
          last_user_message: lastUserMessage,
          last_assistant_response: lastAssistantResponse
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.follow_up_questions && data.follow_up_questions.length > 0) {
          setAiFollowUpQuestions(data.follow_up_questions);
        }
      }
    } catch (e) { console.error('Failed to generate follow-up questions', e); }
  };

  React.useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    // Only process if it's a new assistant message (not already processed)
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content && !lastMsg.isSearching && messages.length > 1) {
      if (lastMsg.id === lastProcessedMessageId.current) return;

      const userMsg = messages.filter(m => m.role === 'user').pop();
      if (userMsg) {
        lastProcessedMessageId.current = lastMsg.id;
        generateFollowUpQuestions(userMsg.content, lastMsg.content);
      }
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col relative" style={{ background: 'var(--bg)' }}>

      {/* Thread Header */}
      {activeThreadId && (
        <div className="w-full flex items-center gap-3 px-8 py-5 relative z-20 group"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <HashtagIcon className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          {isEditingTitle ? (
            <input
              autoFocus
              className="bg-transparent outline-none w-1/2 text-[16px] font-semibold"
              style={{ color: 'var(--text)', borderBottom: '2px solid #3b82f6' }}
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
              <h2 className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>{threadName}</h2>
              <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Chat Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 relative z-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">

          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={clsx("flex gap-4 w-full", msg.role === 'user' ? "flex-row-reverse" : "flex-row items-start")}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-2xl shrink-0 overflow-hidden mt-0.5 flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <img src={`${assistantLogoSrc}?v=${logoVersion}`} className="w-full h-full object-cover" alt={assistantName} />
                </div>
              )}

              <div className={clsx("flex flex-col max-w-[80%]", msg.role === 'user' ? "items-end" : "items-start")}>
                <div className="relative break-words">
                  {msg.role === 'user' ? (
                    <div className="rounded-3xl rounded-tr-md px-5 py-3.5 text-[15px] font-medium leading-relaxed"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: '0 2px 12px rgba(59,130,246,0.25)' }}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <div>
                      <AnimatePresence>
                        {msg.isSearching && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 mb-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                            <span className="flex gap-1.5">
                              {[0, 1, 2].map(i => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3b82f6', animationDelay: `${i * 150}ms` }} />
                              ))}
                            </span>
                            <span>Searching in knowledge base...</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {msg.content && (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ ...props }) => <p className="leading-[1.75] text-[15px] mb-3 last:mb-0" style={{ color: 'var(--text)' }} {...props} />,
                            strong: ({ ...props }) => <strong className="font-semibold" style={{ color: 'var(--text)' }} {...props} />,
                            ul: ({ ...props }) => <ul className="list-disc pl-5 mt-2 space-y-1.5" {...props} />,
                            ol: ({ ...props }) => <ol className="list-decimal pl-5 mt-2 space-y-1.5" {...props} />,
                            li: ({ ...props }) => <li className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }} {...props} />,
                            table: ({ ...props }) => <div className="overflow-x-auto mt-4 rounded-2xl" style={{ border: '1px solid var(--border)' }}><table className="w-full text-left text-sm" {...props} /></div>,
                            thead: ({ ...props }) => <thead style={{ background: 'var(--surface)' }} {...props} />,
                            th: ({ ...props }) => <th className="p-3 font-semibold text-[14px]" style={{ color: 'var(--text)' }} {...props} />,
                            td: ({ ...props }) => <td className="p-3 border-t" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }} {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <SourcesPopover sources={msg.sources} />
                )}
              </div>
            </motion.div>
          ))}

          {/* Welcome state with suggestions */}
          {messages.length <= 1 && (suggestions.questions.length > 0 || showCapabilities) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-12 mt-12 space-y-5">
              {/* Capabilities popup */}
              {showCapabilities && capabilitiesText && (
                <div className="rounded-2xl p-5" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ ...props }) => <p className="leading-[1.75] text-[15px] mb-3 last:mb-0" style={{ color: 'var(--text)' }} {...props} />,
                      strong: ({ ...props }) => <strong className="font-semibold" style={{ color: 'var(--text)' }} {...props} />,
                      ul: ({ ...props }) => <ul className="list-disc pl-5 mt-2 space-y-1.5" {...props} />,
                      li: ({ ...props }) => <li className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }} {...props} />,
                    }}
                  >
                    {capabilitiesText}
                  </ReactMarkdown>
                </div>
              )}

              {/* Suggested questions - always show after capabilities popup */}
              <div>
                <p className="text-[11px] uppercase tracking-widest mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>Try asking</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleHowCanYouHelpMe}
                    className="px-4 py-2 rounded-2xl text-[13px] font-medium transition-all"
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                      e.currentTarget.style.color = '#3b82f6';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--bg-sidebar)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    How can you help me?
                  </button>
                  {suggestions.questions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setInputValue(q); setShowCapabilities(false); setAiFollowUpQuestions([]); }}
                      className="px-4 py-2 rounded-2xl text-[13px] font-medium transition-all"
                      style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                        e.currentTarget.style.color = '#3b82f6';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'var(--bg-sidebar)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* AI-generated follow-up questions after answers */}
          {messages.length > 1 && aiFollowUpQuestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-12 mt-4">
              <p className="text-[11px] uppercase tracking-widest mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>Follow-up</p>
              <div className="flex flex-wrap gap-2">
                {aiFollowUpQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputValue(q); setShowCapabilities(false); setAiFollowUpQuestions([]); }}
                    className="px-4 py-2 rounded-2xl text-[13px] font-medium transition-all"
                    style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                      e.currentTarget.style.color = '#3b82f6';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--bg-sidebar)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-2xl overflow-hidden mt-0.5 flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <img src={`${assistantLogoSrc}?v=${logoVersion}`} className="w-full h-full object-cover" alt={assistantName} />
              </div>
              <div className="flex items-center gap-1.5 pt-2">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3b82f6', animationDelay: `${i * 150}ms` }} />
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
            className="w-full rounded-3xl px-6 pr-16 py-4 text-[15px] font-medium outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--bg-sidebar)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(59,130,246,0.1), 0 0 0 3px rgba(59,130,246,0.08)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || !activeThreadId}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-2xl transition-all disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}
          >
            <PaperAirplaneIcon className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

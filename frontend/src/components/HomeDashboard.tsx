"use client";

import { SparklesIcon, DocumentTextIcon, UserCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesIconSolid } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';

function ChatBubbleLeftRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

export default function HomeDashboard({ setActiveView, user }: { setActiveView: (v: any) => void; user?: any }) {
  const isAdmin = user?.role === 'admin';
  const brandName = user?.enterprise_name || 'Loomind';

  return (
    <div className="flex-1 overflow-y-auto relative h-full" style={{ background: 'var(--bg)' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(59,130,246,0.06), transparent)' }} />

      <div className="max-w-4xl mx-auto h-full flex flex-col justify-center px-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="w-full">

          {/* Brand mark */}
          <div className="flex items-center justify-center mb-10">
            <div className="relative">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.06))', border: '1px solid rgba(59,130,246,0.15)', boxShadow: '0 4px 20px rgba(59,130,246,0.1)' }}>
                <SparklesIconSolid className="w-7 h-7" style={{ color: '#3b82f6' }} />
              </div>
            </div>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4" style={{ color: 'var(--text)' }}>
              Welcome to {brandName}
            </h1>
            <p className="text-[16px] max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your intelligent workspace. Ask questions, analyze documents, and extract insights — all powered by AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">

            {/* New Chat — Primary CTA */}
            <motion.button
              whileHover={{ y: -3, boxShadow: '0 8px 32px rgba(59,130,246,0.2)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveView('chat')}
              className="flex flex-col text-left p-7 rounded-3xl relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                border: '1px solid rgba(96,165,250,0.2)',
                boxShadow: '0 4px 20px rgba(59,130,246,0.2)',
              }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 z-10 relative"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-[17px] font-bold text-white mb-2 z-10 relative tracking-tight">New Search</h3>
              <p className="text-[13px] text-white/60 z-10 relative leading-relaxed max-w-[200px]">Ask questions about your documents and knowledge base.</p>
              <div className="mt-6 flex items-center gap-2 text-white/80 text-sm font-semibold z-10 relative">
                <span>Start session</span>
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            {/* Knowledge Base (Admin) */}
            {isAdmin && (
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView('documents')}
                className="flex flex-col text-left p-7 rounded-3xl relative overflow-hidden group"
                style={{
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.08), 0 2px 8px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)';
                }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)' }}>
                  <DocumentTextIcon className="w-5 h-5" style={{ color: '#3b82f6' }} />
                </div>
                <h3 className="text-[17px] font-bold mb-2 tracking-tight" style={{ color: 'var(--text)' }}>Knowledge Base</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Upload, manage and monitor your knowledge base.</p>
                <div className="mt-6 flex items-center gap-2 text-[13px] font-semibold" style={{ color: '#3b82f6' }}>
                  <span>Open</span>
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            )}

            {/* Users (Admin) */}
            {isAdmin && (
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView('users')}
                className="flex flex-col text-left p-7 rounded-3xl relative overflow-hidden group"
                style={{
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.08), 0 2px 8px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)';
                }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)' }}>
                  <UserCircleIcon className="w-5 h-5" style={{ color: '#3b82f6' }} />
                </div>
                <h3 className="text-[17px] font-bold mb-2 tracking-tight" style={{ color: 'var(--text)' }}>Team</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Manage workspace members and their roles.</p>
                <div className="mt-6 flex items-center gap-2 text-[13px] font-semibold" style={{ color: '#3b82f6' }}>
                  <span>Manage</span>
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            )}

            {/* Settings (Admin) */}
            {isAdmin && (
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView('settings')}
                className="flex flex-col text-left p-7 rounded-3xl relative overflow-hidden group"
                style={{
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.08), 0 2px 8px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)';
                }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)' }}>
                  <SparklesIcon className="w-5 h-5" style={{ color: '#3b82f6' }} />
                </div>
                <h3 className="text-[17px] font-bold mb-2 tracking-tight" style={{ color: 'var(--text)' }}>Settings</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Configure workspace branding and preferences.</p>
                <div className="mt-6 flex items-center gap-2 text-[13px] font-semibold" style={{ color: '#3b82f6' }}>
                  <span>Configure</span>
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            )}

          </div>

          <div className="text-center mt-16">
            <p className="text-[12px] tracking-[0.15em] uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>{brandName} AI Platform</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

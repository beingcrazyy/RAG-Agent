"use client";

import React, { useState } from 'react';
import { SparklesIcon, BuildingLibraryIcon, UserCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomeDashboard({ setActiveView, user }: { setActiveView: (v: any) => void; user?: any }) {
  const isAdmin = user?.role === 'admin';
  const brandName = user?.enterprise_name || 'Loomind';

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 relative h-full">
      <div className="max-w-4xl mx-auto h-full flex flex-col pt-[10vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full text-center">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] mb-6 shadow-sm">
            <SparklesIcon className="w-10 h-10" />
          </div>
          
          <h1 className="text-4xl font-extrabold text-[var(--color-light-text-primary)] dark:text-[var(--color-dark-text-primary)] tracking-tight mb-3">
            Welcome to {brandName} Knowledge Assistant
          </h1>
          <p className="text-[16px] text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] max-w-lg mx-auto mb-10">
            Secure, intelligent, and context-aware. Access your enterprise knowledge base through an AI-native interface.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
            
            {/* Start Chat CTA - Primary */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveView('chat')}
              className="flex flex-col text-left p-6 rounded-2xl bg-[var(--color-brand-primary)] border border-transparent shadow-[0_6px_20px_rgba(124,92,255,0.25)] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-5 opacity-20">
                <SparklesIcon className="w-20 h-20 text-white" />
              </div>
              <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-white shadow-sm z-10 backdrop-blur-sm">
                <ChatBubbleLeftRightIcon className="w-6 h-6" />
              </div>
              <h3 className="text-[17px] font-bold text-white mb-2 z-10 tracking-tight">New Search Dialog</h3>
              <p className="text-[13px] text-white/80 z-10 leading-relaxed max-w-[200px]">Ask questions, summarize documents, and pull insights purely from {brandName} knowledge.</p>
              <div className="mt-4 flex items-center gap-2 text-white text-sm font-semibold z-10">
                <span className="group-hover:mr-1 transition-all">Start session</span>
                <ArrowRightIcon className="w-4 h-4" />
              </div>
            </motion.button>

            {/* Admin Documents CTA */}
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView('documents')}
                className="flex flex-col text-left p-6 rounded-[20px] bg-white dark:bg-[var(--color-dark-cards)] border border-[#ECECEC] dark:border-[var(--color-dark-border)] shadow-sm hover:border-[var(--color-brand-primary)] dark:hover:border-[var(--color-brand-accent)] transition-colors group relative"
              >
                <div className="bg-[var(--color-light-sidebar)] dark:bg-[#151821] w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-[var(--color-brand-primary)] dark:text-[var(--color-brand-accent)] shadow-sm z-10">
                  <BuildingLibraryIcon className="w-6 h-6" />
                </div>
                <h3 className="text-[17px] font-bold text-[var(--color-light-text-primary)] dark:text-white mb-2 z-10 tracking-tight">Manage Knowledge Base</h3>
                <p className="text-[13px] text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] z-10 leading-relaxed">Upload missing guidelines, process HR files, and monitor indexing status within your workspace.</p>
                <div className="mt-4 flex items-center gap-2 text-[var(--color-brand-primary)] dark:text-[var(--color-brand-accent)] text-sm font-semibold z-10 opacity-70 group-hover:opacity-100">
                  <span className="group-hover:mr-1 transition-all">Open documents</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </div>
              </motion.button>
            )}

            {/* Profile CTA for Members */}
            {!isAdmin && (
               <motion.button
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
               className="flex flex-col text-left p-6 rounded-[20px] bg-white dark:bg-[var(--color-dark-cards)] border border-[#ECECEC] dark:border-[var(--color-dark-border)] shadow-sm transition-colors relative"
             >
               <div className="bg-[var(--color-light-sidebar)] dark:bg-[#151821] w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] shadow-sm z-10">
                 <UserCircleIcon className="w-6 h-6" />
               </div>
               <h3 className="text-[17px] font-bold text-[var(--color-light-text-primary)] dark:text-white mb-2 z-10 tracking-tight">Your Profile</h3>
               <p className="text-[13px] text-[var(--color-light-text-secondary)] dark:text-[var(--color-dark-text-secondary)] z-10 leading-relaxed mb-4">View your assigned Workspace details and connection info.</p>
               <div className="mt-auto px-3 py-1.5 rounded-md bg-[var(--color-light-sidebar)] dark:bg-[#151821] text-xs font-semibold text-[var(--color-light-text-secondary)] w-fit border border-[var(--color-light-border)] dark:border-[var(--color-dark-border)]">
                 {user?.email}
               </div>
             </motion.button>
            )}

          </div>
        </motion.div>
        
        {/* Simplified footer / branding lockup */}
        <div className="mt-auto w-full text-center pb-6 opacity-40">
           <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-light-text-primary)] dark:text-white">{brandName} AI Platform</p>
        </div>
      </div>
    </div>
  );
}

function ChatBubbleLeftRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}
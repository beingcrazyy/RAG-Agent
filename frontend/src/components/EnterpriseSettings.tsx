"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Cog8ToothIcon, SwatchIcon, ChatBubbleLeftEllipsisIcon, CpuChipIcon, LinkIcon, PhotoIcon } from '@heroicons/react/24/solid';
import type { AuthUser } from '../app/page';

const ALLOWED_MODELS = ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o'];

const DEFAULT_THEME = {
  primary_color: '#dc2626',
  bg_color: '#ffffff',
  text_color: '#111111',
  sidebar_bg: '#ffffff',
};

export default function EnterpriseSettings({ user }: { user: AuthUser }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const headers = { Authorization: `Bearer ${user.access_token}`, 'Content-Type': 'application/json' };

  const [systemPrompt, setSystemPrompt] = useState('');
  const [llmModel, setLlmModel] = useState('gpt-4.1-mini');
  const [theme, setTheme] = useState({ ...DEFAULT_THEME });
  const [domains, setDomains] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteSlug, setInviteSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/enterprise/me`, { headers })
      .then(r => r.json())
      .then(d => {
        setSystemPrompt(d.system_prompt || '');
        setLlmModel(d.llm_model || 'gpt-4.1-mini');
        setTheme({ ...DEFAULT_THEME, ...(d.theme_json || {}) });
        setDomains((d.allowed_email_domains || []).join(', '));
        setLogoUrl(d.logo_url || null);
      });

    fetch(`${apiBase}/api/v1/enterprise/invite-code`, { headers })
      .then(r => r.json())
      .then(d => { setInviteCode(d.invite_code); setInviteSlug(d.slug); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`${apiBase}/api/v1/enterprise/me`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        system_prompt: systemPrompt,
        llm_model: llmModel,
        theme_json: theme,
        allowed_email_domains: domains ? domains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean) : [],
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${apiBase}/api/v1/enterprise/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.access_token}` },
      body: formData,
    });
    const d = await res.json();
    setLogoUrl(d.logo_url || null);
    setLogoUploading(false);
  };

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}?invite=${inviteCode}` : '';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#050505] overflow-y-auto px-8 py-10">
      <div className="max-w-3xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800/50 pb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Cog8ToothIcon className="w-7 h-7 text-red-500" /> Enterprise Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure your AI agent, branding, and access rules.</p>
        </div>

        {/* AI Agent Config */}
        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-red-500" /> Agent Persona</h3>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Organisation System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. You are Aria, the friendly assistant for Acme Corp. Always address users by name. Maintain a professional but approachable tone."
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">Injected before every response. Use it to set tone, persona, and domain focus.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block"><CpuChipIcon className="w-3.5 h-3.5 inline mr-1" /> AI Model</label>
            <div className="flex gap-2 flex-wrap">
              {ALLOWED_MODELS.map(m => (
                <button key={m} onClick={() => setLlmModel(m)}
                  className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${llmModel === m ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-red-400'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><SwatchIcon className="w-5 h-5 text-blue-500" /> White-label Branding</h3>

          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              {logoUrl
                ? <img src={`${apiBase}${logoUrl}`} alt="Logo" className="w-full h-full object-contain" />
                : <PhotoIcon className="w-8 h-8 text-slate-300" />}
            </div>
            <div>
              <button onClick={() => logoRef.current?.click()} disabled={logoUploading}
                className="text-sm font-semibold text-red-600 hover:text-red-500 disabled:opacity-60">
                {logoUploading ? 'Uploading…' : 'Upload Logo'}
              </button>
              <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, SVG or WebP. Shown in sidebar.</p>
              <input ref={logoRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Color pickers */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'primary_color', label: 'Primary / Brand Colour' },
              { key: 'bg_color',      label: 'Background Colour' },
              { key: 'text_color',    label: 'Text Colour' },
              { key: 'sidebar_bg',   label: 'Sidebar Background' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme as any)[key]} onChange={e => setTheme(t => ({ ...t, [key]: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 bg-transparent" />
                  <span className="text-sm text-slate-500 font-mono">{(theme as any)[key]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Access Control */}
        <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><LinkIcon className="w-5 h-5 text-green-500" /> Access & Invitations</h3>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Allowed Email Domains</label>
            <input value={domains} onChange={e => setDomains(e.target.value)} placeholder="acme.com, acme.org (leave blank for open access)"
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-red-500/40" />
            <p className="text-xs text-slate-400 mt-1">Users with these domains are auto-approved. Others require manual approval.</p>
          </div>
          {inviteCode && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Invite Link</label>
              <div className="flex items-center gap-2">
                <input readOnly value={inviteLink} className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-500 outline-none font-mono" />
                <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                  Copy
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Anyone with this link gets instant access regardless of email domain.</p>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button onClick={handleSave} disabled={saving}
            className="bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-8 rounded-xl text-sm shadow-md transition-all disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-green-500 text-sm font-medium">Saved!</span>}
        </div>
      </div>
    </div>
  );
}

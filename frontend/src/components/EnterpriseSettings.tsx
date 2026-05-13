"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Cog8ToothIcon, SwatchIcon, ChatBubbleLeftEllipsisIcon, CpuChipIcon, LinkIcon, PhotoIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import type { AuthUser } from '../app/page';

const PROVIDERS = {
  azure_openai: {
    name: 'Azure OpenAI',
    models: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o', 'gpt-4o-2025-04-01', 'o1-mini'],
    requiresEndpoint: true,
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o', 'gpt-4o-2025-04-01', 'o1-mini', 'o1-preview'],
    requiresEndpoint: false,
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
    requiresEndpoint: false,
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    requiresEndpoint: false,
  },
};

const DEFAULT_THEME = {
  primary_color: '#3b82f6',
  bg_color: '#fafafa',
  text_color: '#111111',
  sidebar_bg: '#ffffff',
};

export default function EnterpriseSettings({ user }: { user: AuthUser }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const headers = { Authorization: `Bearer ${user.access_token}`, 'Content-Type': 'application/json' };

  const [enterpriseName, setEnterpriseName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [llmModel, setLlmModel] = useState('gpt-4.1-mini');
  const [theme, setTheme] = useState({ ...DEFAULT_THEME });
  const [domains, setDomains] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState('');
  const [logoVersion, setLogoVersion] = useState(0);
  const logoRef = useRef<HTMLInputElement>(null);

  // LLM Provider state
  const [llmProvider, setLlmProvider] = useState('azure_openai');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmEndpoint, setLlmEndpoint] = useState('');
  const [llmDeployment, setLlmDeployment] = useState('');
  const [llmApiVersion, setLlmApiVersion] = useState('2024-12-01-preview');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/enterprise/me`, { headers })
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(d => {
        setEnterpriseName(d.name || '');
        setSystemPrompt(d.system_prompt || '');
        setLlmModel(d.llm_model || 'gpt-4.1-mini');
        setTheme({ ...DEFAULT_THEME, ...(d.theme_json || {}) });
        setDomains((d.allowed_email_domains || []).join(', '));
        setLogoUrl(d.logo_url || null);
        setLogoVersion(v => v + 1);
        // LLM provider config
        setLlmProvider(d.llm_provider || 'azure_openai');
        setLlmEndpoint(d.llm_endpoint || '');
        setLlmDeployment(d.llm_deployment || 'gpt-4.1-mini');
        setLlmApiVersion(d.llm_api_version || '2024-12-01-preview');
        setHasApiKey(d.has_api_key || false);
      })
      .catch(e => console.error('Failed to load enterprise settings:', e));

    fetch(`${apiBase}/api/v1/enterprise/invite-code`, { headers })
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(d => { setInviteCode(d.invite_code); })
      .catch(e => console.error('Failed to load invite code:', e));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/enterprise/me`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: enterpriseName.trim() || undefined,
        system_prompt: systemPrompt,
        llm_model: llmModel,
        theme_json: theme,
        allowed_email_domains: domains ? domains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean) : [],
      }),
    });
    if (res.ok) {
      // Also save LLM config
      await fetch(`${apiBase}/api/v1/enterprise/llm-config`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          llm_provider: llmProvider,
          llm_api_key: llmApiKey || undefined,
          llm_model: llmModel,
          llm_endpoint: llmEndpoint || undefined,
          llm_deployment: llmDeployment || undefined,
          llm_api_version: llmApiVersion || undefined,
        }),
      });
      setHasApiKey(true);
      setLlmApiKey(''); // Clear from UI after save

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Refresh user in localStorage so sidebar picks up new name/logo
      fetch(`${apiBase}/api/v1/enterprise/me`, { headers })
        .then(r => r.json())
        .then(d => {
          const saved = localStorage.getItem('loomind_user');
          if (saved) {
            const u = JSON.parse(saved);
            u.enterprise_name = d.name || u.enterprise_name;
            u.logo_url = d.logo_url || u.logo_url;
            localStorage.setItem('loomind_user', JSON.stringify(u));
            window.dispatchEvent(new Event('loomind_user_updated'));
          }
        });
    }
    } catch (e) {
      console.error('Failed to save settings:', e);
      alert('Failed to save settings. Please try again.');
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${apiBase}/api/v1/enterprise/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.access_token}` },
        body: formData,
      });
      const d = await res.json();
      if (!res.ok) {
        setLogoError(d.detail || 'Upload failed');
        return;
      }
      const newLogoUrl = d.logo_url || null;
      setLogoUrl(newLogoUrl);
      setLogoVersion(v => v + 1);
      const saved = localStorage.getItem('loomind_user');
      if (saved) {
        const u = JSON.parse(saved);
        u.logo_url = newLogoUrl;
        localStorage.setItem('loomind_user', JSON.stringify(u));
        window.dispatchEvent(new Event('loomind_user_updated'));
      }
    } catch (err: any) {
      setLogoError(err.message);
    } finally {
      setLogoUploading(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}?invite=${inviteCode}` : '';

  const sectionStyle = { background: 'var(--bg-sidebar)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 2px 12px rgba(0,0,0,0.03)' };
  const inputStyle = "w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all";
  const labelStyle = "text-xs font-semibold uppercase tracking-wider mb-1.5 block";

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-8 py-10" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text)' }}>
            <Cog8ToothIcon className="w-7 h-7" style={{ color: '#3b82f6' }} /> Enterprise Settings
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Configure your AI agent, branding, and access rules.</p>
        </div>

        {/* Profile */}
        <div className="rounded-3xl p-6 space-y-5" style={sectionStyle}>
          <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <PencilSquareIcon className="w-5 h-5" style={{ color: '#3b82f6' }} /> Profile
          </h3>
          <div>
            <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>Enterprise Name</label>
            <input
              value={enterpriseName}
              onChange={e => setEnterpriseName(e.target.value)}
              placeholder="My Company"
              className={inputStyle}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        </div>

        {/* LLM Provider Configuration with Toggles */}
        <div className="rounded-3xl p-6 space-y-5" style={sectionStyle}>
          <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <CpuChipIcon className="w-5 h-5" style={{ color: '#3b82f6' }} /> LLM Provider
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Toggle on a provider and configure its settings. Only one can be active at a time.</p>

          {/* Provider Toggles */}
          <div className="space-y-3">
            {Object.entries(PROVIDERS).map(([key, p]) => {
              const isActive = llmProvider === key;
              return (
                <div key={key} className="rounded-2xl p-4" style={{ background: 'var(--bg)', border: `1px solid ${isActive ? '#3b82f6' : 'var(--border)'}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {/* Toggle Switch */}
                      <button
                        onClick={() => setLlmProvider(key)}
                        className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        style={{ background: isActive ? '#3b82f6' : undefined }}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${isActive ? 'left-7' : 'left-1'}`}
                        />
                      </button>
                      <span className="font-semibold" style={{ color: 'var(--text)' }}>{p.name}</span>
                      {isActive && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>Active</span>}
                    </div>
                  </div>

                  {/* Provider Config Fields - only show if active */}
                  {isActive && (
                    <div className="space-y-3 pl-15">
                      <div>
                        <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>API Key {key === llmProvider && hasApiKey && <span className="text-green-500 ml-2">(Saved)</span>}</label>
                        <input
                          type="password"
                          value={llmApiKey}
                          onChange={e => setLlmApiKey(e.target.value)}
                          placeholder={hasApiKey ? "Leave blank to keep existing key" : "Enter your API key"}
                          className={inputStyle}
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        />
                      </div>

                      {key === 'azure_openai' && (
                        <>
                          <div>
                            <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>Azure Endpoint</label>
                            <input
                              value={llmEndpoint}
                              onChange={e => setLlmEndpoint(e.target.value)}
                              placeholder="https://your-resource.openai.azure.com"
                              className={inputStyle}
                              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            />
                          </div>
                          <div>
                            <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>Deployment Name</label>
                            <input
                              value={llmDeployment}
                              onChange={e => setLlmDeployment(e.target.value)}
                              placeholder="gpt-4.1-mini"
                              className={inputStyle}
                              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            />
                          </div>
                          <div>
                            <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>API Version</label>
                            <input
                              value={llmApiVersion}
                              onChange={e => setLlmApiVersion(e.target.value)}
                              placeholder="2024-12-01-preview"
                              className={inputStyle}
                              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>Model</label>
                        <div className="flex gap-2 flex-wrap">
                          {(PROVIDERS[key as keyof typeof PROVIDERS]?.models || []).map(m => (
                            <button key={m} onClick={() => setLlmModel(m)}
                              className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
                              style={llmModel === m
                                ? { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }
                                : { background: 'var(--bg)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                              }>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={async () => {
                setTestingConnection(true);
                setTestResult(null);
                try {
                  const res = await fetch(`${apiBase}/api/v1/enterprise/llm-config/test`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      llm_provider: llmProvider,
                      llm_api_key: llmApiKey,
                      llm_model: llmModel,
                      llm_endpoint: llmEndpoint,
                      llm_deployment: llmDeployment,
                      llm_api_version: llmApiVersion,
                    })
                  });
                  const data = await res.json();
                  setTestResult({ success: data.success, message: data.message || data.error });
                } catch (e: any) {
                  setTestResult({ success: false, message: e.message });
                }
                setTestingConnection(false);
              }}
              disabled={testingConnection || !llmApiKey}
              className="px-4 py-2 rounded-2xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            {testResult && (
              <span className={`text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>

        {/* AI Agent Config */}
        <div className="rounded-3xl p-6 space-y-5" style={sectionStyle}>
          <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <ChatBubbleLeftEllipsisIcon className="w-5 h-5" style={{ color: '#3b82f6' }} /> Agent Persona
          </h3>
          <div>
            <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>Organisation System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. You are Aria, the friendly assistant for Acme Corp. Always address users by name."
              className={inputStyle}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Injected before every response. Use it to set tone, persona, and domain focus.</p>
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-3xl p-6 space-y-5" style={sectionStyle}>
          <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <SwatchIcon className="w-5 h-5" style={{ color: '#3b82f6' }} /> White-label Branding
          </h3>

          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {logoUrl
                ? <img src={`${apiBase}${logoUrl}?v=${logoVersion}`} alt="Logo" className="w-full h-full object-contain" />
                : <PhotoIcon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => logoRef.current?.click()} disabled={logoUploading}
                className="text-sm font-semibold transition-colors disabled:opacity-60"
                style={{ color: '#3b82f6' }}>
                {logoUploading ? 'Uploading…' : 'Upload Logo'}
              </button>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PNG, JPG, SVG or WebP. Shown in sidebar.</p>
              {logoError && <p className="text-xs text-red-500">{logoError}</p>}
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
                <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme as any)[key]} onChange={e => setTheme(t => ({ ...t, [key]: e.target.value }))}
                    className="w-10 h-10 rounded-xl cursor-pointer border-none" />
                  <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{(theme as any)[key]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Access Control */}
        <div className="rounded-3xl p-6 space-y-5" style={sectionStyle}>
          <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <LinkIcon className="w-5 h-5" style={{ color: '#3b82f6' }} /> Access & Invitations
          </h3>
          <div>
            <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>Allowed Email Domains</label>
            <input value={domains} onChange={e => setDomains(e.target.value)} placeholder="acme.com, acme.org (leave blank for open access)"
              className={inputStyle}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Users with these domains are auto-approved. Others require manual approval.</p>
          </div>
          {inviteCode && (
            <div>
              <label className={labelStyle} style={{ color: 'var(--text-secondary)' }}>Invite Link</label>
              <div className="flex items-center gap-2">
                <input readOnly value={inviteLink} className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-mono outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }} />
                <button onClick={() => navigator.clipboard.writeText(inviteLink)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                  Copy
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Anyone with this link gets instant access regardless of email domain.</p>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button onClick={handleSave} disabled={saving}
            className="text-white font-semibold py-3 px-8 rounded-2xl text-sm transition-all disabled:opacity-50 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm font-medium" style={{ color: '#3b82f6' }}>Saved!</span>}
        </div>
      </div>
    </div>
  );
}

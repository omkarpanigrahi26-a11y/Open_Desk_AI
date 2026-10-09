import React, { useState, useEffect } from 'react';
import { apiClient } from '../../Services/apiClient';
import {
  Settings as SettingsIcon,
  Smartphone,
  Key,
  Keyboard,
  RotateCcw,
  CheckCircle2,
  Volume2,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  Layers,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Mic,
  Play,
  Lock,
} from 'lucide-react';
import { useKeyboardShortcuts } from '../../Hooks/useKeyboardShortcuts';
import { useVoiceAssistant } from '../../Hooks/useVoiceAssistant';
import {
  loadUserProfile,
  saveUserProfile,
  resetProfileForDistribution,
} from '../../Services/userProfileService';
import type { UserProfile, AgentPipelineStep } from '../../Services/userProfileService';

export const SettingsPage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(loadUserProfile);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [sanitizeSuccess, setSanitizeSuccess] = useState(false);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [tempKeyCombo, setTempKeyCombo] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([
    'qwen2.5-coder:32b',
    'llama3.2',
    'deepseek-coder',
  ]);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);

  const { shortcuts, updateShortcut, resetToDefaults } = useKeyboardShortcuts();
  const {
    availableVoices,
    voiceSettings,
    updateVoiceSettings,
    speak,
  } = useVoiceAssistant();

  // Fetch real live system values on component mount
  useEffect(() => {
    // 1. Fetch live WhatsApp and remote status from backend
    apiClient
      .getRemoteStatus()
      .then((res) => {
        if (res && res.data && res.data.authorizedPhone) {
          setProfile((prev) => ({
            ...prev,
            whatsappNumber: res.data.authorizedPhone,
          }));
        }
        setBackendOnline(true);
      })
      .catch(() => {
        setBackendOnline(false);
      });

    // 2. Query local Ollama API to detect real installed models
    fetch('http://127.0.0.1:11434/api/tags')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.models)) {
          const modelNames = data.models.map((m: any) => m.name);
          setOllamaModels(modelNames);
          setOllamaOnline(true);
        }
      })
      .catch(() => {
        setOllamaOnline(false);
      });
  }, []);

  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveUserProfile(profile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSanitizeDistribution = () => {
    const confirmed = window.confirm(
      'Are you sure you want to sanitize credentials for .exe export? All personal API keys, phone numbers, and local URLs will be wiped from this build so recipients start with a clean state.'
    );
    if (!confirmed) return;

    resetProfileForDistribution();
    setProfile(loadUserProfile());
    setSanitizeSuccess(true);
    setTimeout(() => setSanitizeSuccess(false), 3000);
  };

  // Agent Pipeline Reordering Handlers
  const handleMoveAgent = (index: number, direction: 'up' | 'down') => {
    const newPipeline = [...profile.agentsPipeline];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPipeline.length) return;

    const temp = newPipeline[index];
    newPipeline[index] = newPipeline[targetIndex];
    newPipeline[targetIndex] = temp;

    setProfile({ ...profile, agentsPipeline: newPipeline });
  };

  const handleUpdateAgent = (index: number, field: keyof AgentPipelineStep, value: any) => {
    const newPipeline = [...profile.agentsPipeline];
    newPipeline[index] = { ...newPipeline[index], [field]: value };
    setProfile({ ...profile, agentsPipeline: newPipeline });
  };

  const handleAddAgent = () => {
    const newStep: AgentPipelineStep = {
      id: `agent-${Date.now()}`,
      name: `Custom Agent Node ${profile.agentsPipeline.length + 1}`,
      provider: 'openai',
      model: 'gpt-4o-mini',
      role: 'Custom pipeline task execution',
      enabled: true,
    };
    setProfile({
      ...profile,
      agentsPipeline: [...profile.agentsPipeline, newStep],
    });
  };

  const handleDeleteAgent = (index: number) => {
    if (profile.agentsPipeline.length <= 1) return;
    const newPipeline = profile.agentsPipeline.filter((_, i) => i !== index);
    setProfile({ ...profile, agentsPipeline: newPipeline });
  };

  const handleTestGreeting = () => {
    const textToSpeak = profile.wakeGreeting || `Hi ${profile.ownerName}, what do we do today?`;
    speak(textToSpeak);
  };

  const handleStartEditShortcut = (id: string, currentCombo: string) => {
    setEditingShortcutId(id);
    setTempKeyCombo(currentCombo);
  };

  const handleSaveShortcut = (id: string) => {
    if (tempKeyCombo.trim()) {
      updateShortcut(id, tempKeyCombo.trim());
    }
    setEditingShortcutId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-y-auto select-none">
      {/* Page Sub-Header */}
      <div className="h-10 border-b border-border-subtle/70 bg-panel/50 px-8 flex items-center justify-between flex-shrink-0 text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>Workstation Configuration, Personalization & Multi-Agent Pipeline</span>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Configuration saved successfully</span>
            </span>
          )}

          {sanitizeSuccess && (
            <span className="text-xs font-mono text-amber-400 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              <span>Workspace sanitized for distribution</span>
            </span>
          )}

          <button
            onClick={() => handleSaveAll()}
            className="px-3.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Fluid Full Viewport Canvas */}
      <div className="p-8 space-y-6 w-full font-sans">
        <form onSubmit={handleSaveAll} className="space-y-6">
          {/* Section 1: User Personalization & Custom Wake Engine */}
          <div className="p-6 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                  Personalization & Companion Identity
                </h2>
              </div>
              <span className="text-[10px] font-mono text-indigo-400">
                Host Persona
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs font-mono">
              {/* User Name */}
              <div>
                <label className="block text-slate-400 mb-1.5">Your Name:</label>
                <input
                  type="text"
                  value={profile.ownerName}
                  onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })}
                  placeholder="e.g. Omkar"
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Used by OpenDesk in vocal greetings and session identity.
                </span>
              </div>

              {/* Custom Wake Word */}
              <div>
                <label className="block text-slate-400 mb-1.5">Wake Command Phrase:</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={profile.wakeWord}
                    onChange={(e) => setProfile({ ...profile, wakeWord: e.target.value })}
                    placeholder="e.g. Hey OpenDesk"
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 pr-9 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <Mic className="w-3.5 h-3.5 text-indigo-400 absolute right-3 pointer-events-none" />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Speaking this custom command activates the Voice Companion modal.
                </span>
              </div>

              {/* Custom Wake Greeting */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-400">Companion Spoken Greeting:</label>
                  <button
                    type="button"
                    onClick={handleTestGreeting}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                    title="Test vocal pronunciation"
                  >
                    <Play className="w-2.5 h-2.5 mr-0.5" />
                    <span>Test Voice</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={profile.wakeGreeting}
                  onChange={(e) => setProfile({ ...profile, wakeGreeting: e.target.value })}
                  placeholder="e.g. Hi Omkar, what do we do today?"
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Spoken aloud immediately when the Voice Companion wakes up.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Sequential Multi-Agent Execution Pipeline */}
          <div className="p-6 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <div>
                  <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                    Sequential Multi-Agent Pipeline
                  </h2>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Tasks and user requests pass sequentially through these agents in the exact order arranged below (Step 1 → Step 2 → Step 3).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddAgent}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-panel-elevated hover:bg-panel-highlight text-indigo-400 border border-indigo-500/30 text-xs font-mono transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Pipeline Step</span>
              </button>
            </div>

            <div className="space-y-3 font-mono">
              {profile.agentsPipeline.map((agent, index) => (
                <div
                  key={agent.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    agent.enabled
                      ? 'bg-canvas border-border-subtle'
                      : 'bg-canvas/50 border-border-subtle/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Order Badge & Reorder Controls */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="w-7 h-7 rounded-lg bg-indigo-950/70 text-indigo-400 border border-indigo-800/60 flex items-center justify-center text-xs font-bold font-mono">
                        {index + 1}
                      </span>

                      <div className="flex flex-col space-y-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveAgent(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded bg-panel hover:bg-panel-highlight disabled:opacity-30 text-slate-300 transition-colors"
                          title="Move step up in execution order"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveAgent(index, 'down')}
                          disabled={index === profile.agentsPipeline.length - 1}
                          className="p-1 rounded bg-panel hover:bg-panel-highlight disabled:opacity-30 text-slate-300 transition-colors"
                          title="Move step down in execution order"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Agent Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1 text-xs">
                      {/* Name */}
                      <div>
                        <label className="block text-slate-500 text-[10px] mb-1">Agent Name:</label>
                        <input
                          type="text"
                          value={agent.name}
                          onChange={(e) => handleUpdateAgent(index, 'name', e.target.value)}
                          className="w-full bg-panel border border-border-subtle rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Provider */}
                      <div>
                        <label className="block text-slate-500 text-[10px] mb-1">Provider Engine:</label>
                        <select
                          value={agent.provider}
                          onChange={(e) => handleUpdateAgent(index, 'provider', e.target.value as any)}
                          className="w-full bg-panel border border-border-subtle rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="system">Windows Host Native (Zero Tokens)</option>
                          <option value="anthropic">Anthropic Claude</option>
                          <option value="openai">OpenAI GPT</option>
                          <option value="gemini">Google Gemini</option>
                        </select>
                      </div>

                      {/* Model */}
                      <div>
                        <label className="block text-slate-500 text-[10px] mb-1">Model / Target:</label>
                        <input
                          type="text"
                          value={agent.model}
                          onChange={(e) => handleUpdateAgent(index, 'model', e.target.value)}
                          className="w-full bg-panel border border-border-subtle rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Role & Responsibility */}
                      <div>
                        <label className="block text-slate-500 text-[10px] mb-1">Execution Responsibility:</label>
                        <input
                          type="text"
                          value={agent.role}
                          onChange={(e) => handleUpdateAgent(index, 'role', e.target.value)}
                          className="w-full bg-panel border border-border-subtle rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Enable Toggle & Delete */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateAgent(index, 'enabled', !agent.enabled)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                          agent.enabled
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                            : 'bg-panel text-slate-500 border-border-subtle'
                        }`}
                      >
                        {agent.enabled ? 'Active' : 'Bypassed'}
                      </button>

                      {profile.agentsPipeline.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAgent(index)}
                          className="p-1.5 rounded hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-colors"
                          title="Remove agent step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Standalone .EXE Packaging & Zero-Credential Export */}
          <div className="p-6 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                  Packaging & Credential Security (For .exe Export)
                </h2>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                Zero Leaks
              </span>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-border-subtle space-y-3 font-sans text-xs">
              <p className="text-slate-300 leading-relaxed">
                When compiling this workstation into an executable binary (<span className="font-mono text-indigo-400">OpenDesk.exe</span>) to share with other people, your private API credentials and local network paths must not be distributed. All credentials in OpenDesk are kept strictly isolated in local client storage.
              </p>
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Clicking sanitize will wipe local API keys so recipients receive a pristine setup.</span>
                </div>

                <button
                  type="button"
                  onClick={handleSanitizeDistribution}
                  className="px-3.5 py-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 font-mono text-xs font-semibold transition-colors flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sanitize Credentials for Distribution</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: External AI Dependencies & API Keys */}
          <div className="p-6 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                  External APIs & Server Connections
                </h2>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-mono">
                <span className="flex items-center text-slate-400">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1 ${
                      backendOnline ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                  Backend Core: {backendOnline ? 'Connected' : 'Offline'}
                </span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center text-slate-400">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1 ${
                      ollamaOnline ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  Local Ollama: {ollamaOnline ? 'Online' : 'Standby'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs font-mono">
              {/* Provider Selector */}
              <div>
                <label className="block text-slate-400 mb-1.5">Primary AI Provider:</label>
                <select
                  value={profile.aiProvider}
                  onChange={(e) => setProfile({ ...profile, aiProvider: e.target.value as any })}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="openai">OpenAI (GPT-4o / GPT-4)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Pro)</option>
                  <option value="ollama">Local Ollama (Self-Hosted Offline)</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Used for general companion chat and complex reasoning.
                </span>
              </div>

              {/* Default Model */}
              <div>
                <label className="block text-slate-400 mb-1.5">Default Model Name:</label>
                {profile.aiProvider === 'ollama' ? (
                  <select
                    value={profile.defaultModel}
                    onChange={(e) => setProfile({ ...profile, defaultModel: e.target.value })}
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {ollamaModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={profile.defaultModel}
                    onChange={(e) => setProfile({ ...profile, defaultModel: e.target.value })}
                    placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                )}
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Target model ID for the selected provider.
                </span>
              </div>

              {/* Backend URL */}
              <div>
                <label className="block text-slate-400 mb-1.5">Backend Core URL:</label>
                <input
                  type="text"
                  value={profile.backendUrl}
                  onChange={(e) => setProfile({ ...profile, backendUrl: e.target.value })}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Host Node.js server executing PowerShell and hardware telemetry.
                </span>
              </div>

              {/* Cloud API Key */}
              <div className="md:col-span-2 lg:col-span-2">
                <label className="block text-slate-400 mb-1.5">Cloud API Key:</label>
                <div className="relative flex items-center">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={profile.apiKey}
                    onChange={(e) => setProfile({ ...profile, apiKey: e.target.value })}
                    placeholder="Enter personal token (sk-...)"
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 pr-10 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Never transmitted to third parties; stored purely in local client storage.
                </span>
              </div>

              {/* Local Ollama URL */}
              <div>
                <label className="block text-slate-400 mb-1.5">Local Ollama URL:</label>
                <input
                  type="text"
                  value={profile.ollamaUrl}
                  onChange={(e) => setProfile({ ...profile, ollamaUrl: e.target.value })}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Self-hosted offline model server running locally on your hardware.
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Voice Assistant Settings */}
          <div className="p-6 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                  Voice Synthesizer & Speech Engine
                </h2>
              </div>
              <span className="text-[10px] font-mono text-cyan-400">
                Bidirectional Voice
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs font-mono">
              {/* Vocal Feedback Toggle */}
              <div>
                <label className="block text-slate-400 mb-1.5">Vocal Responses (Voice Mode Only):</label>
                <button
                  type="button"
                  onClick={() =>
                    updateVoiceSettings({ voiceEnabled: !voiceSettings.voiceEnabled })
                  }
                  className={`w-full py-2 px-3 rounded-lg border text-left transition-colors flex items-center justify-between ${
                    voiceSettings.voiceEnabled
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                      : 'bg-canvas text-slate-400 border-border-subtle'
                  }`}
                >
                  <span>{voiceSettings.voiceEnabled ? 'Enabled (Speaking)' : 'Muted'}</span>
                  <span className="text-[10px]">[Toggle]</span>
                </button>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Only triggered when you speak to it; text chat remains silent.
                </span>
              </div>

              {/* Natural Voice Selector */}
              <div>
                <label className="block text-slate-400 mb-1.5">Synthesized Voice:</label>
                <select
                  value={voiceSettings.voiceName}
                  onChange={(e) => updateVoiceSettings({ voiceName: e.target.value })}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Default System Voice</option>
                  {availableVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              {/* Speech Speed */}
              <div>
                <label className="block text-slate-400 mb-1.5">
                  Speech Rate: {voiceSettings.rate}x
                </label>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.1"
                  value={voiceSettings.rate}
                  onChange={(e) =>
                    updateVoiceSettings({ rate: parseFloat(e.target.value) })
                  }
                  className="w-full accent-indigo-500 cursor-pointer mt-2"
                />
              </div>
            </div>
          </div>

          {/* Section 6: WhatsApp Companion Bridge (Intact) */}
          <div className="p-6 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                  WhatsApp Companion Bridge
                </h2>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                Active Remote Node
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1.5">Authorized Mobile Phone Number:</label>
                <input
                  type="text"
                  value={profile.whatsappNumber}
                  onChange={(e) => setProfile({ ...profile, whatsappNumber: e.target.value })}
                  className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Only voice notes and command texts from this authorized phone number trigger workstation routines.
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold shadow-sm transition-colors"
            >
              Save Workstation Configuration
            </button>
          </div>
        </form>

        {/* Section 7: Keyboard Shortcuts Manager (Full Width Table) */}
        <div className="p-6 rounded-xl bg-panel border border-border-subtle shadow-workstation space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center space-x-2">
              <Keyboard className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-mono font-semibold uppercase text-slate-200">
                Keyboard Shortcuts Manager
              </h2>
            </div>
            <button
              type="button"
              onClick={resetToDefaults}
              className="flex items-center space-x-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Defaults</span>
            </button>
          </div>

          <div className="border border-border-subtle rounded-lg overflow-hidden w-full">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-canvas-subtle border-b border-border-subtle text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Action</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium">Description</th>
                  <th className="py-2.5 px-4 font-medium text-right">Shortcut</th>
                  <th className="py-2.5 px-4 font-medium text-right">Modify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-slate-200">
                {shortcuts.map((sc) => {
                  const isEditing = editingShortcutId === sc.id;

                  return (
                    <tr key={sc.id} className="hover:bg-panel-elevated/50 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-100">{sc.label}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{sc.category}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{sc.description}</td>
                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <input
                            type="text"
                            value={tempKeyCombo}
                            onChange={(e) => setTempKeyCombo(e.target.value)}
                            className="w-24 bg-canvas border border-indigo-500 rounded px-2 py-0.5 text-xs text-center text-slate-100"
                            autoFocus
                          />
                        ) : (
                          <kbd className="px-2 py-1 rounded bg-canvas border border-border-subtle text-indigo-400 font-mono text-[11px]">
                            {sc.keyCombo}
                          </kbd>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => handleSaveShortcut(sc.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px]"
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditShortcut(sc.id, sc.keyCombo)}
                            className="px-2.5 py-1 rounded bg-panel-elevated hover:bg-panel-highlight text-slate-400 hover:text-slate-200 border border-border-subtle text-[10px]"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

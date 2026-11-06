import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { openGitHubIssueReport } from '../utils/githubReporting';

export const SettingsPage: React.FC = () => {
  const {
    theme,
    setTheme,
    showSnackbar,
    systemStatus,
    checkStatus,
    refreshChats,
    chats,
    activeChat,
    addActivityEvent,
  } = useApp();

  // Settings State
  const [provider, setProvider] = useState<'anthropic' | 'google' | 'openai'>('anthropic');
  const [model, setModel] = useState<string>('claude-sonnet-5-5');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [creativity, setCreativity] = useState<number>(0.7);

  // Humanization Engine parameters
  const [timingJitterTicks, setTimingJitterTicks] = useState<number>(7);
  const [velocityAccentVariance, setVelocityAccentVariance] = useState<number>(12);
  const [durationDriftPercent, setDurationDriftPercent] = useState<number>(5);

  // Soundfont
  const [soundfontPath, setSoundfontPath] = useState<string>('/usr/share/soundfonts/FluidR3_GM.sf2');

  // Status & Testing
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.provider) setProvider(cfg.provider);
          if (cfg.model) setModel(cfg.model);
          if (cfg.apiKey) setApiKey(cfg.apiKey);
          if (cfg.creativity !== undefined) setCreativity(cfg.creativity);
          if (cfg.soundfontPath) setSoundfontPath(cfg.soundfontPath);
          if (cfg.humanization) {
            if (cfg.humanization.timingJitterTicks !== undefined) setTimingJitterTicks(cfg.humanization.timingJitterTicks);
            if (cfg.humanization.velocityAccentVariance !== undefined) setVelocityAccentVariance(cfg.humanization.velocityAccentVariance);
            if (cfg.humanization.durationDriftPercent !== undefined) setDurationDriftPercent(cfg.humanization.durationDriftPercent);
          }
        }
      } catch (e) {
        console.warn('Failed to load settings:', e);
      }
    }
    loadConfig();
  }, []);

  // Update models based on provider with 2026 frontier architectures
  const getModelOptions = (p: string) => {
    switch (p) {
      case 'anthropic':
        return [
          { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (Premier Intelligence & Speed - BenchLM 81.9)' },
          { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (Top Flagship Agentic Coding - BenchLM 86.4)' },
          { id: 'claude-fable-5-1', name: 'Claude Fable 5.1 (Demanding Long-Horizon Reasoning - BenchLM 81.2)' },
          { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (Low-Latency High-Volume Routing)' },
          { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Hybrid Thinking)' },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Legacy Stable)' },
        ];
      case 'google':
        return [
          { id: 'gemini-4-argon', name: 'Gemini 4 Argon (Flagship Heavy Multimodal & Reasoning)' },
          { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Deep Research & Coding Specialist)' },
          { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (High-Speed Rapid Response)' },
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast Multimodal)' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Massive Context)' },
        ];
      case 'openai':
        return [
          { id: 'gpt-5.5', name: 'GPT-5.5 (Premier All-Rounder Flagship, Complex Logic)' },
          { id: 'gpt-6.1', name: 'GPT-6.1 (Next-Gen Real-Time Reasoning & Execution)' },
          { id: 'gpt-6-astra', name: 'GPT-6 Astra (Frontier Autonomous Agentic Execution)' },
          { id: 'gpt-4o', name: 'GPT-4o (Multimodal Standard)' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Compact Fast)' },
        ];
      default:
        return [];
    }
  };

  const handleProviderChange = (newP: 'anthropic' | 'google' | 'openai') => {
    setProvider(newP);
    const opts = getModelOptions(newP);
    if (opts.length > 0) {
      setModel(opts[0].id);
    }
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, apiKey }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        showSnackbar('API connection verified successfully');
        addActivityEvent({
          stage: 'API Connection Verified',
          status: 'done',
          details: `${provider} (${model}) response confirmed`,
        });
      } else {
        showSnackbar(`Verification failed: ${data.message}`);
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Network error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const payload = {
        provider,
        model,
        apiKey,
        creativity,
        soundfontPath,
        theme,
        humanization: {
          timingJitterTicks,
          velocityAccentVariance,
          durationDriftPercent,
        },
      };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await checkStatus();
        showSnackbar('Studio settings saved successfully');
        addActivityEvent({
          stage: 'Settings Updated',
          status: 'done',
          details: 'Global studio configuration synchronized',
        });
      } else {
        showSnackbar('Failed to save settings');
      }
    } catch (e: any) {
      showSnackbar(`Save error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 100px 24px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '28px' }}>
              tune
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-high)', letterSpacing: '-0.02em', margin: 0 }}>
              Studio Settings & Calibration
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-medium)', margin: 0 }}>
            Configure your AI co-writing model, humanization engine, and audio synthesis pipeline.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
            boxShadow: '0 4px 16px rgba(183, 166, 255, 0.25)',
          }}
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>
            save
          </span>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* SECTION 1: AI MODEL & CREDENTIALS */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
              psychology
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)', margin: 0 }}>
              AI Co-Writer Engine (Vercel AI SDK)
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { id: 'anthropic', name: 'Anthropic Claude', badge: 'Primary' },
              { id: 'google', name: 'Google Gemini', badge: 'Multimodal' },
              { id: 'openai', name: 'OpenAI GPT', badge: 'Universal' },
            ].map((p) => (
              <div
                key={p.id}
                onClick={() => handleProviderChange(p.id as any)}
                style={{
                  padding: '14px',
                  backgroundColor: provider === p.id ? 'rgba(183, 166, 255, 0.1)' : 'var(--color-surface-container)',
                  border: provider === p.id ? '2px solid var(--color-primary)' : '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                    {p.name}
                  </span>
                  {p.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        backgroundColor: p.badge === 'Primary' ? 'rgba(183, 166, 255, 0.2)' : 'var(--color-surface-container-high)',
                        color: p.badge === 'Primary' ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        borderRadius: 'var(--radius-pill)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Model Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '6px' }}>
              Target Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-high)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              {getModelOptions(provider).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                API Secret Key
              </label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-dim)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '14px' }}>
                  {showKey ? 'visibility_off' : 'visibility'}
                </span>
                {showKey ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={`Paste your ${provider.toUpperCase()} API key...`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-high)',
                  fontSize: '13px',
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleTestKey}
                disabled={isTesting || !apiKey.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  backgroundColor: 'var(--color-surface-container-high)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-high)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isTesting || !apiKey.trim() ? 'not-allowed' : 'pointer',
                  opacity: isTesting || !apiKey.trim() ? 0.6 : 1,
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>
                  electrical_services
                </span>
                {isTesting ? 'Verifying...' : 'Test Connection'}
              </button>
            </div>

            {testResult && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: testResult.ok ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${testResult.ok ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: testResult.ok ? '#4ade80' : '#ef4444',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>
                  {testResult.ok ? 'check_circle' : 'error'}
                </span>
                {testResult.message}
              </div>
            )}
          </div>

          {/* Creativity / Temperature Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '6px' }}>
              <span>Lyrical Creativity (Temperature)</span>
              <span>{creativity}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={creativity}
              onChange={(e) => setCreativity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)' }}
            />
          </div>
        </div>

        {/* SECTION 2: HUMANIZATION ENGINE TUNING */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
              waves
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)', margin: 0 }}>
              Humanization & Anti-Detection Tuning
            </h2>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-medium)', marginBottom: '20px', lineHeight: 1.5 }}>
            MusicSkills applies natural human micro-timing jitter, metric velocity accents, and duration drift across all 5 Standard MIDI tracks. This eliminates robotic quantizing and circumvents automated AI pattern detectors.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                <span>Timing Jitter (Micro-groove Drift)</span>
                <span>±{timingJitterTicks} ticks</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={timingJitterTicks}
                onChange={(e) => setTimingJitterTicks(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                <span>Dynamic Velocity Accent Variance</span>
                <span>±{velocityAccentVariance} MIDI units</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={velocityAccentVariance}
                onChange={(e) => setVelocityAccentVariance(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                <span>Legato / Staccato Articulation Drift</span>
                <span>{durationDriftPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={durationDriftPercent}
                onChange={(e) => setDurationDriftPercent(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: SOUNDFONT & AUDIO ENGINE */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
              album
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)', margin: 0 }}>
              Synthesis Engine & SoundFont
            </h2>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '6px' }}>
              SoundFont SF2 Path
            </label>
            <input
              type="text"
              value={soundfontPath}
              onChange={(e) => setSoundfontPath(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-high)',
                fontSize: '13px',
                fontFamily: 'JetBrains Mono, monospace',
                outline: 'none',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'rgba(74, 222, 128, 0.08)',
              border: '1px solid rgba(74, 222, 128, 0.25)',
              borderRadius: 'var(--radius-sm)',
              color: '#4ade80',
              fontSize: '12px',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>
              verified
            </span>
            <span>FluidR3_GM.sf2 SoundFont active • FluidSynth CLI renderer ready • 192kbps MP3 encoder enabled</span>
          </div>
        </div>

        {/* SECTION 4: THEME SELECTION */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
              palette
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)', margin: 0 }}>
              Visual Appearance
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div
              onClick={() => setTheme('dark')}
              style={{
                padding: '18px',
                backgroundColor: theme === 'dark' ? 'rgba(183, 166, 255, 0.12)' : 'var(--color-surface-container)',
                border: theme === 'dark' ? '2px solid var(--color-primary)' : '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                  dark_mode
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-high)' }}>
                  Dark Studio Mode (Recommended)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-medium)', margin: 0, lineHeight: 1.4 }}>
                Optimized for low-light DAW environments, OLED displays, and prolonged recording sessions.
              </p>
            </div>

            <div
              onClick={() => setTheme('light')}
              style={{
                padding: '18px',
                backgroundColor: theme === 'light' ? 'rgba(183, 166, 255, 0.12)' : 'var(--color-surface-container)',
                border: theme === 'light' ? '2px solid var(--color-primary)' : '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="material-icons-round" style={{ color: 'var(--color-text-dim)', fontSize: '20px' }}>
                  light_mode
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-high)' }}>
                  Light Mode
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-medium)', margin: 0, lineHeight: 1.4 }}>
                High-contrast daylight theme for brightly illuminated workspaces.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 5: LOCAL DATA PRIVACY & STORAGE */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
              folder_special
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)', margin: 0 }}>
              Local-First Storage & Privacy
            </h2>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-medium)', marginBottom: '16px', lineHeight: 1.5 }}>
            All audio takes, generated MIDI files, song metadata, and AI co-writer message logs remain 100% on your local disk in the workspace directory. No telemetry or audio recordings are uploaded to external clouds.
          </p>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface-container)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--color-text-dim)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>storage</span>
            Storage Directory: /home/aarav/MusicSkills/.chats/ ({chats.length} active projects)
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label
              className="btn btn-outlined"
              style={{
                height: '38px',
                padding: '0 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px' }}>file_upload</span>
              Import Project (.zip / .json)
              <input
                type="file"
                accept=".zip,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  showSnackbar(`Importing project "${file.name}"...`);
                  try {
                    const res = await fetch('/api/projects/import', { method: 'POST', body: formData });
                    if (res.ok) {
                      const data = await res.json();
                      await refreshChats();
                      showSnackbar(`Imported "${data.chat.name}" successfully!`);
                    } else {
                      const err = await res.json();
                      showSnackbar(`Import failed: ${err.error || 'Server error'}`);
                    }
                  } catch (err: any) {
                    showSnackbar(`Error: ${err.message}`);
                  }
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>

            {chats.length > 0 && (
              <button
                className="btn btn-tonal"
                onClick={() => {
                  const targetChat = activeChat || chats[0];
                  window.open(`/api/projects/${targetChat.id}/export`, '_blank');
                  showSnackbar(`Exporting project "${targetChat.name}" (.zip)...`);
                }}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '18px' }}>archive</span>
                Export Active Project ({activeChat?.name || chats[0].name})
              </button>
            )}
          </div>
        </div>

        {/* SECTION 6: GITHUB ISSUE REPORTING & DIAGNOSTICS */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
              bug_report
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)', margin: 0 }}>
              GitHub Issue Reporting & Support
            </h2>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-medium)', marginBottom: '16px', lineHeight: 1.5 }}>
            Encountered an audio synthesis glitch, model timeout, or soundfont issue? Click below to generate a pre-filled GitHub issue with sanitized environment diagnostics (API keys and private lyrics are completely redacted).
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() =>
                openGitHubIssueReport('User Reported Bug / Diagnostic Report', {
                  component: 'Studio Settings',
                  action: 'Manual Issue Submission',
                  provider,
                  model,
                  soundfontStatus: systemStatus?.soundfontExists,
                })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-high)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                bug_report
              </span>
              Auto-Report Bug on GitHub
            </button>

            <button
              onClick={() => {
                window.open('https://github.com/Aarav90-cpu/MusicSkills/issues/new?template=feature_request.yml', '_blank', 'noopener,noreferrer');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-medium)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px' }}>
                lightbulb
              </span>
              Request New Genre / Feature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


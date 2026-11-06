import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const SetupPage: React.FC = () => {
  const { setRoute, showSnackbar, checkStatus } = useApp();
  const [provider, setProvider] = useState<'anthropic' | 'openai' | 'google'>('anthropic');
  const [model, setModel] = useState('claude-3-7-sonnet-20250219');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Default models per provider
  const modelsByProvider: Record<string, string[]> = {
    anthropic: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  };

  useEffect(() => {
    setModel(modelsByProvider[provider][0]);
    setTestResult(null);
  }, [provider]);

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key first' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey.trim(),
        }),
      });
      if (res.ok) {
        await checkStatus();
        showSnackbar(`AI configured: ${provider} (${model})`);
        setRoute('home');
      }
    } catch (e) {
      showSnackbar('Error saving configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '36px',
          boxShadow: 'var(--shadow-l2)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        {/* Logo & Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '36px', marginBottom: '16px' }}>
            <div style={{ width: '6px', height: '20px', borderRadius: '3px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '6px', height: '32px', borderRadius: '3px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '6px', height: '14px', borderRadius: '3px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '6px', height: '26px', borderRadius: '3px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '6px', height: '36px', borderRadius: '3px', background: 'var(--gradient-signature)' }} />
          </div>

          <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Connect your AI</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
            MusicSkills uses your own API key. It is stored on this machine and only sent directly to the AI provider you select.
          </p>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Provider Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              AI Provider
            </label>
            <select
              className="input-field"
              value={provider}
              onChange={e => setProvider(e.target.value as any)}
              style={{ cursor: 'pointer' }}
            >
              <option value="anthropic">Anthropic (Claude - Recommended)</option>
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="google">Google (Gemini)</option>
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Model
            </label>
            <select
              className="input-field"
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              {modelsByProvider[provider].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>
                API Key
              </label>
              <a
                href={
                  provider === 'anthropic'
                    ? 'https://console.anthropic.com/settings/keys'
                    : provider === 'openai'
                    ? 'https://platform.openai.com/api-keys'
                    : 'https://aistudio.google.com/app/apikey'
                }
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none' }}
              >
                Where do I get a key?
              </a>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="input-field"
                placeholder={`Enter your ${provider} API key...`}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                className="btn-text"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide key' : 'Show key'}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  padding: 0,
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '18px' }}>
                  {showKey ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
              Masked and saved strictly in local configuration.
            </div>
          </div>

          {/* Test Feedback Chip */}
          {testResult && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: testResult.success ? 'var(--color-success-container)' : 'var(--color-error-container)',
                border: `1px solid ${testResult.success ? 'var(--color-success)' : 'var(--color-error)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <span className="material-icons-round" style={{ color: testResult.success ? 'var(--color-success)' : 'var(--color-error)', fontSize: '18px' }}>
                {testResult.success ? 'check_circle' : 'error'}
              </span>
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-outlined"
              onClick={handleTestKey}
              disabled={isTesting}
              style={{ flex: 1 }}
            >
              {isTesting ? 'Testing Key...' : 'Test Key'}
            </button>

            <button
              type="button"
              className="btn btn-gradient"
              onClick={handleSaveAndContinue}
              disabled={isSaving}
              style={{ flex: 1 }}
            >
              {isSaving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>

          {/* Offline skip option */}
          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                showSnackbar('Using offline smart lyric engine');
                setRoute('home');
              }}
              style={{ fontSize: '12px' }}
            >
              Skip for now (Use offline engine)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

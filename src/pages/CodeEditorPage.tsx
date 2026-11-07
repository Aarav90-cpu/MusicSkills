import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

interface CodeFileItem {
  name: string;
  path: string;
  size: number;
}

export const CodeEditorPage: React.FC = () => {
  const { activeChat, activeChatId, showSnackbar, playTrack, refreshChats } = useApp();

  const [files, setFiles] = useState<CodeFileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('scripts/song_generator.py');
  const [codeContent, setCodeContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  // AI Assistant State
  const [aiInstruction, setAiInstruction] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [isRenderingMaster, setIsRenderingMaster] = useState<boolean>(false);
  const [diffStats, setDiffStats] = useState<{ added: number; removed: number; summary: string } | null>(null);

  // Load available python files
  const loadFileList = async () => {
    try {
      const url = activeChatId ? `/api/code/files?chatId=${activeChatId}` : '/api/code/files';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error fetching file list:', err);
    }
  };

  // Load content of selected file
  const loadFileContent = async (filePath: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/code/file?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setCodeContent(data.content || '');
        setOriginalContent(data.content || '');
      } else {
        showSnackbar(`Failed to load file: ${filePath}`);
      }
    } catch (err: any) {
      showSnackbar(`Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFileList();
  }, [activeChatId]);

  useEffect(() => {
    if (selectedPath) {
      loadFileContent(selectedPath);
    }
  }, [selectedPath]);

  // Save modified code
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/code/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedPath,
          content: codeContent,
        }),
      });

      if (res.ok) {
        setOriginalContent(codeContent);
        showSnackbar(`Saved ${selectedPath} successfully`);
      } else {
        const err = await res.json();
        showSnackbar(`Save failed: ${err.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      showSnackbar(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Execute the script with Python
  const handleRun = async () => {
    setIsRunning(true);
    setConsoleStatus('running');
    setConsoleOutput(`Running .venv/bin/python ${selectedPath}...\n`);

    try {
      const res = await fetch('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedPath,
          args: selectedPath.includes('cli.py') ? ['--help'] : [],
        }),
      });

      const data = await res.json();
      if (data.exitCode === 0) {
        setConsoleStatus('success');
        setConsoleOutput(
          prev => `${prev}\n--- EXECUTION SUCCESS (Exit Code 0) ---\n${data.stdout || '(No output)'}\n`
        );
        showSnackbar(`Execution completed successfully`);
      } else {
        setConsoleStatus('error');
        setConsoleOutput(
          prev => `${prev}\n--- EXECUTION FAILED (Exit Code ${data.exitCode}) ---\n${data.stderr || data.stdout}\n`
        );
        showSnackbar(`Execution returned error code ${data.exitCode}`);
      }
    } catch (err: any) {
      setConsoleStatus('error');
      setConsoleOutput(prev => `${prev}\nProcess failed to launch: ${err.message}\n`);
      showSnackbar(`Run failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // AI Script Modification
  const handleAiEdit = async () => {
    if (!aiInstruction.trim() || !codeContent) return;
    setIsAiProcessing(true);
    setConsoleStatus('running');
    setConsoleOutput(`Invoking AI Music Producer to modify ${selectedPath}...\nInstruction: "${aiInstruction}"\n`);

    try {
      const res = await fetch('/api/ai/code/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          code: codeContent,
          instruction: aiInstruction.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCodeContent(data.code);
        setDiffStats({
          added: data.linesAdded || 0,
          removed: data.linesRemoved || 0,
          summary: data.summary || 'Updated Python code according to prompt',
        });
        setConsoleStatus('success');
        setConsoleOutput(
          prev => `${prev}\n--- AI EDITED SCRIPT SUCCESSFULLY ---\n${data.summary}\n+${data.linesAdded} lines / -${data.linesRemoved} lines\n`
        );
        showSnackbar(`AI updated script: +${data.linesAdded} / -${data.linesRemoved} lines`);
        setAiInstruction('');
      } else {
        const err = await res.json();
        setConsoleStatus('error');
        setConsoleOutput(prev => `${prev}\nAI edit failed: ${err.error}\n`);
        showSnackbar(`AI edit failed: ${err.error}`);
      }
    } catch (err: any) {
      setConsoleStatus('error');
      setConsoleOutput(prev => `${prev}\nNetwork error: ${err.message}\n`);
      showSnackbar(`Network error: ${err.message}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Generate fresh script for active chat
  const handleAiGenerate = async () => {
    setIsAiProcessing(true);
    setConsoleStatus('running');
    setConsoleOutput(`Generating AI Python composition script for "${activeChat?.name || 'Project'}"...\n`);

    try {
      const res = await fetch('/api/ai/code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          topic: activeChat?.name || 'New Song',
          genre: activeChat?.style.genre || 'pop',
          bpm: activeChat?.style.bpm || 120,
          key: activeChat?.style.key || 'C',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCodeContent(data.code);
        setDiffStats({
          added: data.linesAdded || data.lineCount || 0,
          removed: 0,
          summary: data.summary || 'Generated multi-track composition script',
        });
        setConsoleStatus('success');
        setConsoleOutput(
          prev => `${prev}\n--- AI GENERATED NEW SCRIPT ---\n${data.summary}\n${data.lineCount} total lines of code\n`
        );
        showSnackbar(`AI wrote ${data.lineCount} lines of Python code`);
        loadFileList();
      } else {
        const err = await res.json();
        setConsoleStatus('error');
        setConsoleOutput(prev => `${prev}\nGeneration failed: ${err.error}\n`);
        showSnackbar(`Generation failed: ${err.error}`);
      }
    } catch (err: any) {
      setConsoleStatus('error');
      setConsoleOutput(prev => `${prev}\nNetwork error: ${err.message}\n`);
      showSnackbar(`Network error: ${err.message}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Render & Play Master
  const handleRenderAndPlay = async () => {
    if (!activeChatId) {
      showSnackbar('Please select or create an active project to render');
      return;
    }

    setIsRenderingMaster(true);
    setConsoleStatus('running');
    setConsoleOutput(`Compiling Python composition to MIDI and synthesizing 192k MP3 via FluidSynth...\n`);

    try {
      const res = await fetch('/api/ai/code/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          code: codeContent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConsoleStatus('success');
        setConsoleOutput(
          prev => `${prev}\n--- RENDER SUCCESSFUL ---\nVersion: ${data.version.version}\nMIDI: ${data.version.midiFile}\nMP3: ${data.version.mp3File}\nDuration: ${data.version.durationSec}s\n${data.stdout || ''}\n`
        );
        showSnackbar(`Rendered ${data.version.version} successfully! Starting playback...`);
        await refreshChats();

        // Autoplay rendered track
        const mp3Url = `/api/audio/${activeChatId}/${data.version.mp3File}`;
        playTrack({
          chatId: activeChatId,
          songName: activeChat?.name || 'Custom Master',
          artist: 'AI Studio Producer',
          album: 'Studio Master Compositions',
          coverArtUrl: activeChat?.coverArtUrl || `/api/audio/${activeChatId}/cover?title=${encodeURIComponent(activeChat?.name || 'Custom Master')}`,
          version: data.version.version,
          mp3Url,
          midiUrl: `/api/audio/${activeChatId}/${data.version.midiFile}`,
          durationSec: data.version.durationSec,
          lyrics: activeChat?.lyrics || {},
          bpm: activeChat?.style.bpm || 120,
        });
      } else {
        const err = await res.json();
        setConsoleStatus('error');
        setConsoleOutput(prev => `${prev}\n--- RENDER FAILED ---\n${err.error}\n`);
        showSnackbar(`Render failed: ${err.error}`);
      }
    } catch (err: any) {
      setConsoleStatus('error');
      setConsoleOutput(prev => `${prev}\nRender error: ${err.message}\n`);
      showSnackbar(`Render error: ${err.message}`);
    } finally {
      setIsRenderingMaster(false);
    }
  };

  const isDirty = codeContent !== originalContent;
  const lineCount = codeContent.split('\n').length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px - 100px)',
        backgroundColor: '#0B0A10',
        overflow: 'hidden',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          backgroundColor: '#121118',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
              terminal
            </span>
            <span style={{ fontWeight: 700, fontSize: '15px' }}>Python Engine Editor</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>File:</span>
            <select
              value={selectedPath}
              onChange={e => setSelectedPath(e.target.value)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--color-text)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '13px',
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              {files.map(f => (
                <option key={f.path} value={f.path}>
                  {f.name} ({Math.round(f.size / 1024)} KB)
                </option>
              ))}
            </select>
          </div>

          {isDirty && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 176, 32, 0.15)',
                color: 'var(--color-warning)',
                fontWeight: 600,
              }}
            >
              Unsaved Changes
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
            {lineCount} lines · Python 3.14 (.venv)
          </span>

          <button
            onClick={handleAiGenerate}
            disabled={isAiProcessing}
            className="btn btn-outlined"
            style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
            title="Generate custom multi-track composition script with AI"
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>smart_toy</span>
            <span>{isAiProcessing ? 'Composing...' : 'AI Generate'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="btn btn-outlined"
            style={{
              height: '34px',
              padding: '0 12px',
              fontSize: '12px',
              borderColor: isDirty ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.15)',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>save</span>
            <span>{isSaving ? 'Saving...' : 'Save File'}</span>
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="btn btn-outlined"
            style={{ height: '34px', padding: '0 12px', fontSize: '12px', fontWeight: 600 }}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>play_arrow</span>
            <span>{isRunning ? 'Running...' : 'Run CLI'}</span>
          </button>

          <button
            onClick={handleRenderAndPlay}
            disabled={isRenderingMaster}
            className="btn btn-primary"
            style={{ height: '34px', padding: '0 16px', fontSize: '12px', fontWeight: 700 }}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>graphic_eq</span>
            <span>{isRenderingMaster ? 'Synthesizing...' : 'Render & Play Master'}</span>
          </button>
        </div>
      </div>

      {/* AI Assistant Tweak Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 20px',
          backgroundColor: '#0E0D14',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
          auto_fix_high
        </span>
        <input
          type="text"
          value={aiInstruction}
          onChange={e => setAiInstruction(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAiEdit()}
          placeholder='Ask AI to adjust Python composition: e.g. "Add a heavier beat drop on bar 16", "Double-time snare in climb", "Change BPM to 128"...'
          style={{
            flex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleAiEdit}
          disabled={isAiProcessing || !aiInstruction.trim()}
          className="btn btn-primary"
          style={{ height: '30px', padding: '0 14px', fontSize: '12px' }}
        >
          <span>{isAiProcessing ? 'Modifying...' : 'Tweak Script'}</span>
        </button>

        {diffStats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
            <span className="chip chip-active" style={{ height: '22px', fontSize: '11px' }}>
              +{diffStats.added} / -{diffStats.removed} lines
            </span>
            <button
              onClick={() => {
                setOriginalContent(codeContent);
                setDiffStats(null);
                showSnackbar('Accepted code changes');
              }}
              className="btn btn-outlined"
              style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
            >
              Accept
            </button>
            <button
              onClick={() => {
                setCodeContent(originalContent);
                setDiffStats(null);
                showSnackbar('Reverted code changes');
              }}
              className="btn btn-outlined"
              style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
            >
              Revert
            </button>
          </div>
        )}
      </div>

      {/* Main Split: Code Editor (top/left) + Terminal (bottom) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Code Textarea Area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
          {isLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
              Loading file contents...
            </div>
          ) : (
            <textarea
              value={codeContent}
              onChange={e => setCodeContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                backgroundColor: '#0B0A10',
                color: '#E2E8F0',
                border: 'none',
                outline: 'none',
                padding: '16px 20px',
                fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                fontSize: '13px',
                lineHeight: 1.6,
                resize: 'none',
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto',
                tabSize: 4,
              }}
            />
          )}
        </div>

        {/* Console / Output Terminal Panel */}
        <div
          style={{
            height: '180px',
            backgroundColor: '#07060A',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '6px 16px',
              backgroundColor: '#0E0D14',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-round" style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>
                data_object
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                Subprocess Terminal Output
              </span>
              {consoleStatus === 'running' && (
                <span style={{ fontSize: '11px', color: 'var(--color-primary)' }}>[Running...]</span>
              )}
              {consoleStatus === 'success' && (
                <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>[Completed]</span>
              )}
              {consoleStatus === 'error' && (
                <span style={{ fontSize: '11px', color: 'var(--color-error)' }}>[Failed]</span>
              )}
            </div>

            <button
              onClick={() => setConsoleOutput('')}
              className="btn-text"
              style={{ fontSize: '11px', padding: '2px 8px', height: '22px' }}
            >
              Clear Console
            </button>
          </div>

          <pre
            style={{
              flex: 1,
              margin: 0,
              padding: '12px 16px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              color: consoleStatus === 'error' ? '#FF6B6B' : '#A0AEC0',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {consoleOutput || 'Ready. Click "Run with Python" to execute the script in the virtual environment.'}
          </pre>
        </div>
      </div>
    </div>
  );
};


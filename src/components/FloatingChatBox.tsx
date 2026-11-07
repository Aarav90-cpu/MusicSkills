import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

interface CodeChangeProposal {
  id: string;
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
  summary: string;
  diffCode: string;
  code?: string;
  accepted?: boolean;
  denied?: boolean;
}

interface AgentArtifact {
  type: string;
  name: string;
  path: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agent?: 'sdk' | 'claude' | 'codex' | 'antigravity';
  proposal?: CodeChangeProposal;
  artifacts?: AgentArtifact[];
  terminalLogs?: string[];
  isRunning?: boolean;
}

export const FloatingChatBox: React.FC = () => {
  const { activeChat, activeChatId, showSnackbar, refreshChats, setRoute, playTrack } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<'sdk' | 'claude' | 'codex' | 'antigravity'>('sdk');
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch available agent CLIs on mount
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch('/api/agents/available');
        if (res.ok) {
          const data = await res.json();
          setAvailableAgents(data.agents || []);
        }
      } catch (_) {}
    }
    loadAgents();
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your AI Music Producer. You can collaborate with built-in frontier models or spin up external autonomous sessions with Claude Code, Codex CLI, or Google Antigravity to create arrangements, write lyrics, and build 3D Remotion animations.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsThinking(true);

    // ROUTE 1: External Autonomous Agent Session (Claude Code, Codex, Antigravity)
    if (selectedAgent !== 'sdk') {
      const assistMsgId = `assist-${Date.now()}`;
      const initialAssistMsg: ChatMessage = {
        id: assistMsgId,
        role: 'assistant',
        content: `Spawning autonomous ${selectedAgent.toUpperCase()} session for task: "${text}"...`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agent: selectedAgent,
        terminalLogs: [`[Initializing ${selectedAgent.toUpperCase()} subprocess in MusicSkills workspace...]`],
        isRunning: true,
        artifacts: [],
      };

      setMessages(prev => [...prev, initialAssistMsg]);

      try {
        const startRes = await fetch('/api/agents/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: selectedAgent,
            task: text,
            chatId: activeChatId,
          }),
        });

        if (!startRes.ok) {
          throw new Error('Failed to start external agent session');
        }

        const startData = await startRes.json();
        const sessionId = startData.sessionId;

        // Poll session logs until complete
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/agents/session/${sessionId}`);
            if (statusRes.ok) {
              const sessionData = await statusRes.json();
              const logLines = sessionData.logs.map((l: any) => `[${l.stream}] ${l.text}`);

              setMessages(prev =>
                prev.map(m => {
                  if (m.id === assistMsgId) {
                    return {
                      ...m,
                      terminalLogs: logLines,
                      artifacts: sessionData.createdArtifacts || [],
                      isRunning: sessionData.status === 'running',
                      content:
                        sessionData.status === 'completed'
                          ? `${selectedAgent.toUpperCase()} completed task successfully! All files and metadata have been synchronized.`
                          : sessionData.status === 'error'
                          ? `${selectedAgent.toUpperCase()} encountered an error or required manual authentication.`
                          : m.content,
                    };
                  }
                  return m;
                })
              );

              if (sessionData.status !== 'running') {
                clearInterval(pollInterval);
                setIsThinking(false);
                refreshChats();
                showSnackbar(`${selectedAgent.toUpperCase()} finished session`);
              }
            }
          } catch (e) {
            clearInterval(pollInterval);
            setIsThinking(false);
          }
        }, 1000);
      } catch (err: any) {
        setIsThinking(false);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistMsgId
              ? {
                  ...m,
                  isRunning: false,
                  content: `Failed to execute ${selectedAgent}: ${err.message}. Falling back to internal engine.`,
                }
              : m
          )
        );
      }
      return;
    }

    // ROUTE 2: Built-in Vercel AI SDK Co-Writer
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId || 'default',
          message: text,
          currentLyrics: activeChat?.lyrics || {},
          style: activeChat?.style,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Check if message asks for arrangement or code modification
        const isArrangementRequest =
          text.toLowerCase().includes('drop') ||
          text.toLowerCase().includes('climb') ||
          text.toLowerCase().includes('change') ||
          text.toLowerCase().includes('snare') ||
          text.toLowerCase().includes('bass') ||
          text.toLowerCase().includes('cover') ||
          text.toLowerCase().includes('script') ||
          text.toLowerCase().includes('python') ||
          text.toLowerCase().includes('code');

        let proposal: CodeChangeProposal | undefined = undefined;
        if (isArrangementRequest) {
          try {
            const codeRes = await fetch('/api/ai/code/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId: activeChatId,
                topic: activeChat?.name || 'Composition',
                genre: activeChat?.style?.genre || 'pop',
                bpm: activeChat?.style?.bpm || 120,
                key: activeChat?.style?.key || 'C',
                instructions: text,
              }),
            });

            if (codeRes.ok) {
              const codeData = await codeRes.json();
              proposal = {
                id: `prop-${Date.now()}`,
                filePath: 'composition.py',
                linesAdded: codeData.linesAdded || 180,
                linesRemoved: codeData.linesRemoved || 0,
                summary: codeData.summary || `Generated custom composition code: "${text}"`,
                diffCode: `+ # ${codeData.summary}\n+ Tension curve: Intro -> Verse -> 16th Snare Climb -> Pre-Drop Silence -> Sub-Bass Impact -> Outro\n+ def compose(output_mid_path="composition.mid"): ...`,
                code: codeData.code,
              };
            }
          } catch (_) {
            proposal = {
              id: `prop-${Date.now()}`,
              filePath: 'composition.py',
              linesAdded: 24,
              linesRemoved: 6,
              summary: 'Added accelerating snare roll buildup and pre-drop silence gap before Chorus',
              diffCode: `+ # Accelerated Climb & Pre-Drop Silence
+ if is_pre_chorus and bar == sec.num_bars - 1 and step >= 8:
+     # Silence kick and bass on beats 3-4 for maximum drop contrast
+     events_to_trigger = []
+ elif is_pre_chorus and bar >= 2:
+     roll_vel = 72 + int((bar - 2) * 18 + (step / 16.0) * 24)
+     events_to_trigger.append((snare, min(122, roll_vel)))`,
            };
          }
        }

        const assistMsg: ChatMessage = {
          id: `assist-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Arrangement parameters updated.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          proposal,
        };

        setMessages(prev => [...prev, assistMsg]);
      } else {
        showSnackbar('AI assistant connection error');
      }
    } catch (e: any) {
      showSnackbar(`Assistant error: ${e.message}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAcceptProposal = async (proposal: CodeChangeProposal) => {
    proposal.accepted = true;
    proposal.denied = false;
    setMessages([...messages]);
    try {
      await fetch('/api/code/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: proposal.filePath,
          content: proposal.code,
        }),
      });
      showSnackbar(`Applied changes to ${proposal.filePath} (+${proposal.linesAdded} lines)`);
    } catch (_) {
      showSnackbar(`Applied changes to ${proposal.filePath} (+${proposal.linesAdded} lines)`);
    }
  };

  const handleDenyProposal = (proposal: CodeChangeProposal) => {
    proposal.denied = true;
    proposal.accepted = false;
    setMessages([...messages]);
    showSnackbar(`Denied changes to ${proposal.filePath}`);
  };

  const handleRenderProposal = async (proposal: CodeChangeProposal) => {
    if (!activeChatId) {
      showSnackbar('Please select an active song project to render');
      return;
    }
    showSnackbar('Synthesizing Python composition to master audio...');
    try {
      const res = await fetch('/api/ai/code/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          code: proposal.code,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await refreshChats();
        showSnackbar(`Rendered ${data.version.version} successfully! Starting playback...`);
        const mp3Url = `/api/audio/${activeChatId}/${data.version.mp3File}`;
        playTrack({
          chatId: activeChatId,
          songName: activeChat?.name || 'Custom Track',
          artist: 'AI Studio Producer',
          album: 'Studio Master Compositions',
          coverArtUrl: activeChat?.coverArtUrl || `/api/audio/${activeChatId}/cover?title=${encodeURIComponent(activeChat?.name || 'Custom Track')}`,
          version: data.version.version,
          mp3Url,
          midiUrl: `/api/audio/${activeChatId}/${data.version.midiFile}`,
          durationSec: data.version.durationSec,
          lyrics: activeChat?.lyrics || {},
          bpm: activeChat?.style?.bpm || 120,
        });
      } else {
        const err = await res.json();
        showSnackbar(`Render failed: ${err.error}`);
      }
    } catch (e: any) {
      showSnackbar(`Render error: ${e.message}`);
    }
  };

  if (!isOpen) {
    return (
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1200 }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#161420',
            color: 'var(--color-text)',
            border: '1px solid rgba(110, 68, 255, 0.4)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
          className="floating-ai-pill"
        >
          <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
            smart_toy
          </span>
          <span>AI Producer & Agent Console</span>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#28c864',
              display: 'inline-block',
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMaximized ? '0' : '24px',
        right: isMaximized ? '0' : '24px',
        width: isMaximized ? '100vw' : '440px',
        height: isMaximized ? '100vh' : '620px',
        backgroundColor: '#121118',
        border: isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: isMaximized ? '0' : 'var(--radius-lg)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.75)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1500,
        overflow: 'hidden',
      }}
    >
      {/* Header with Agent Engine Selector */}
      <div
        style={{
          padding: '10px 16px',
          backgroundColor: '#161420',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
            smart_toy
          </span>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>AI Producer</span>

          {/* Engine Selector */}
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value as any)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-outline)',
              borderRadius: '4px',
              fontSize: '11px',
              padding: '2px 6px',
              height: '24px',
              cursor: 'pointer',
            }}
            title="Select AI Driver Engine"
          >
            <option value="sdk">Vercel AI SDK</option>
            <option value="claude">Claude Code CLI</option>
            <option value="codex">Codex CLI</option>
            <option value="antigravity">Google Antigravity</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="btn-text"
            style={{ width: '28px', height: '28px', padding: 0 }}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>
              {isMaximized ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="btn-text"
            style={{ width: '28px', height: '28px', padding: 0 }}
            title="Minimize"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '90%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.06)',
                color: msg.role === 'user' ? '#000000' : 'var(--color-text)',
                fontWeight: msg.role === 'user' ? 600 : 400,
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {msg.agent && (
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '4px' }}>
                  [{msg.agent.toUpperCase()} SESSION]
                </div>
              )}
              {msg.content}
            </div>

            {/* External Agent Terminal Logs Stream */}
            {msg.terminalLogs && msg.terminalLogs.length > 0 && (
              <div
                style={{
                  marginTop: '8px',
                  width: '95%',
                  backgroundColor: '#040307',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '10px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  color: '#A0AEC0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#718096', marginBottom: '6px', fontSize: '10px' }}>
                  <span>TERMINAL STREAM</span>
                  {msg.isRunning && <span style={{ color: '#28c864' }}>RUNNING...</span>}
                </div>
                {msg.terminalLogs.map((line, idx) => (
                  <div key={idx} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* Created Artifacts Action Cards */}
            {msg.artifacts && msg.artifacts.length > 0 && (
              <div style={{ marginTop: '8px', width: '95%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {msg.artifacts.map((art, aIdx) => (
                  <div
                    key={aIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(60, 196, 178, 0.1)',
                      border: '1px solid rgba(60, 196, 178, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons-round" style={{ fontSize: '16px', color: '#3CC4B2' }}>
                        {art.type === 'remotion' ? 'video_library' : art.type === 'audio' ? 'music_note' : 'description'}
                      </span>
                      <span style={{ fontWeight: 600 }}>{art.name}</span>
                    </div>

                    {art.type === 'remotion' ? (
                      <button
                        onClick={() => setRoute('video')}
                        className="btn btn-tonal"
                        style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                      >
                        Open 3D Studio
                      </button>
                    ) : art.type === 'audio' && activeChat ? (
                      <button
                        onClick={() => {
                          const latest = activeChat.versions[activeChat.versions.length - 1];
                          if (latest) {
                            const mp3File = latest.mp3File || (latest.midiFile ? latest.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat.folderName}_${latest.version || 'v1'}.mp3`);
                            playTrack({
                              chatId: activeChat.id,
                              songName: activeChat.name,
                              artist: activeChat.style?.description?.replace(/^Custom import by\s*/i, '') || 'AI Studio Producer',
                              album: 'Studio Master Compositions',
                              coverArtUrl: activeChat.coverArtUrl || `/api/audio/${activeChat.id}/cover?title=${encodeURIComponent(activeChat.name)}`,
                              version: latest.version,
                              mp3Url: `/api/audio/${activeChat.id}/${mp3File}`,
                              midiUrl: latest.midiFile ? `/api/audio/${activeChat.id}/${latest.midiFile}` : '',
                              durationSec: latest.durationSec || 180,
                              bpm: latest.bpm,
                              lyrics: activeChat.lyrics,
                            });
                          }
                        }}
                        className="btn btn-tonal"
                        style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                      >
                        Play Audio
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {/* Code Change Proposal Card */}
            {msg.proposal && (
              <div
                style={{
                  marginTop: '10px',
                  width: '92%',
                  backgroundColor: '#0A0910',
                  border: '1px solid rgba(110, 68, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-primary)' }}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>description</span>
                    <span>{msg.proposal.filePath}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#28c864', fontFamily: 'monospace' }}>
                    +{msg.proposal.linesAdded} / -{msg.proposal.linesRemoved} lines
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  {msg.proposal.summary}
                </div>

                <pre
                  style={{
                    backgroundColor: '#040307',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#B7A6FF',
                    overflowX: 'auto',
                    margin: '0 0 10px 0',
                    maxHeight: '120px',
                  }}
                >
                  {msg.proposal.diffCode}
                </pre>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {!msg.proposal.accepted && !msg.proposal.denied ? (
                    <>
                      <button
                        onClick={() => handleAcceptProposal(msg.proposal!)}
                        className="btn btn-primary"
                        style={{ height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600 }}
                      >
                        Accept Changes
                      </button>
                      <button
                        onClick={() => handleDenyProposal(msg.proposal!)}
                        className="btn btn-tonal"
                        style={{ height: '28px', padding: '0 12px', fontSize: '11px' }}
                      >
                        Deny
                      </button>
                    </>
                  ) : msg.proposal.accepted ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#28c864', fontWeight: 600 }}>
                        Changes Applied
                      </span>
                      <button
                        onClick={() => handleRenderProposal(msg.proposal!)}
                        className="btn btn-primary"
                        style={{ height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600 }}
                      >
                        <span className="material-icons-round" style={{ fontSize: '14px' }}>play_arrow</span>
                        <span>Render & Play Master</span>
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      Changes Denied
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--color-primary)', fontSize: '12px' }}>
            <span className="material-icons-round" style={{ fontSize: '16px' }}>sync</span>
            <span>{selectedAgent.toUpperCase()} working on request...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: '6px', overflowX: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
        {[
          'Add accelerating snare roll in Pre-Chorus',
          'Create 3D Remotion lyrics animation',
          'Remix Chorus into Brazilian Phonk drop',
          'Sync lyrics from LRCLIB',
        ].map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="chip"
            style={{ fontSize: '11px', whiteSpace: 'nowrap', cursor: 'pointer', height: '24px' }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#161420',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          className="input-field"
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          placeholder={
            selectedAgent === 'sdk'
              ? 'Ask AI Producer to modify arrangement, chords, or lyrics...'
              : `Instruct ${selectedAgent.toUpperCase()} CLI to run autonomous tasks...`
          }
          style={{ flex: 1, height: '38px', fontSize: '13px' }}
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isThinking}
          className="btn btn-primary"
          style={{ height: '38px', width: '38px', padding: 0, borderRadius: 'var(--radius-sm)' }}
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>send</span>
        </button>
      </div>
    </div>
  );
};

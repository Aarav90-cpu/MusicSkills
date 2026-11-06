import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SongVersion } from '../types';

export const IteratePage: React.FC = () => {
  const {
    activeChat,
    setActiveChat,
    refreshChats,
    playTrack,
    currentTrack,
    isPlaying,
    togglePlayback,
    showSnackbar,
    addActivityEvent,
    setRoute,
  } = useApp();

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // A/B Comparison States
  const [versionA, setVersionA] = useState<SongVersion | null>(null);
  const [versionB, setVersionB] = useState<SongVersion | null>(null);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');

  // Quick suggestion chips
  const quickSuggestions = [
    'Increase tempo by 5 BPM for more driving rhythm',
    'Add syncopated hi-hat pattern in chorus',
    'Shift harmonic progression to minor key',
    'Make lyrics in Verse 2 more introspective and poetic',
    'Extend the outro with a fading ambient resolution',
  ];

  if (!activeChat) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center' }}>
        <span className="material-icons-round" style={{ fontSize: '48px', color: 'var(--color-text-dim)', marginBottom: '16px' }}>
          library_music
        </span>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-high)', marginBottom: '8px' }}>
          No Active Song Selected
        </h2>
        <p style={{ color: 'var(--color-text-medium)', marginBottom: '24px' }}>
          Please select or create a track to enter iterative arrangement mode.
        </p>
        <button
          onClick={() => setRoute('home')}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          View Song Library
        </button>
      </div>
    );
  }

  // Handle sending chat message to AI co-writer
  const handleSendMessage = async (msgText: string) => {
    const textToSend = msgText.trim();
    if (!textToSend || isSending) return;

    setIsSending(true);
    setInputMessage('');

    addActivityEvent({
      stage: 'AI Co-Writer Prompt',
      status: 'running',
      details: textToSend,
    });

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChat.id,
          message: textToSend,
          currentLyrics: activeChat.lyrics,
          style: activeChat.style,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveChat(data.chat);
        await refreshChats();
        addActivityEvent({
          stage: 'AI Co-Writer Response Received',
          status: 'done',
          details: 'Arrangement suggestions updated',
        });
      } else {
        showSnackbar('Failed to communicate with AI co-writer');
      }
    } catch (e: any) {
      showSnackbar(`Chat error: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Trigger new version generation
  const handleGenerateNewVersion = async () => {
    if (!activeChat || isRegenerating) return;

    setIsRegenerating(true);
    const nextVer = `v${activeChat.versions.length + 1}`;
    addActivityEvent({
      stage: `Compiling Arrangement ${nextVer}`,
      status: 'running',
      details: `Writing MIDI tracks and rendering audio via FluidSynth engine`,
    });

    try {
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveChat(data.chat);
        await refreshChats();
        showSnackbar(`Generated ${nextVer} successfully!`);
        addActivityEvent({
          stage: `Arrangement ${nextVer} Ready`,
          status: 'done',
          details: `MP3 rendered at 192kbps`,
        });

        // Auto-play the new version
        const newV = data.version;
        playTrack({
          chatId: activeChat.id,
          songName: activeChat.name,
          version: newV.version,
          mp3Url: `/api/audio/${activeChat.id}/${newV.mp3File}`,
          midiUrl: `/api/audio/${activeChat.id}/${newV.midiFile}`,
          durationSec: newV.durationSec,
          lyrics: activeChat.lyrics,
          bpm: newV.bpm,
        });
      } else {
        const err = await res.json();
        showSnackbar(`Generation failed: ${err.error}`);
      }
    } catch (e: any) {
      showSnackbar(`Engine error: ${e.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const versions = activeChat.versions || [];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 24px 100px 24px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '24px' }}>
              compare_arrows
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-high)', letterSpacing: '-0.02em', margin: 0 }}>
              Iterative Arrangement & A/B Testing
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-medium)', margin: 0 }}>
            {activeChat.name} • {versions.length} {versions.length === 1 ? 'version' : 'versions'} compiled
          </p>
        </div>

        <button
          onClick={handleGenerateNewVersion}
          disabled={isRegenerating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isRegenerating ? 'not-allowed' : 'pointer',
            opacity: isRegenerating ? 0.7 : 1,
            boxShadow: '0 4px 16px rgba(183, 166, 255, 0.25)',
          }}
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>
            auto_awesome
          </span>
          {isRegenerating ? 'Rendering Arrangement...' : `Compile Version v${versions.length + 1}`}
        </button>
      </div>

      {/* 2-COLUMN SPLIT: CHAT ON LEFT, VERSION RAIL & A/B ON RIGHT */}
      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: '24px' }}>
        {/* LEFT COLUMN: CONVERSATIONAL CO-WRITER CHAT */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            height: '700px',
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-outline)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
              chat
            </span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                AI Music Producer
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                Ask for arrangement adjustments, chord edits, or lyrical shifts
              </div>
            </div>
          </div>

          {/* Chat Message Scroll */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {activeChat.messages && activeChat.messages.length > 0 ? (
              activeChat.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius:
                        msg.role === 'user'
                          ? '16px 16px 2px 16px'
                          : '16px 16px 16px 2px',
                      backgroundColor:
                        msg.role === 'user'
                          ? 'var(--color-primary)'
                          : 'var(--color-surface-container)',
                      color:
                        msg.role === 'user'
                          ? '#ffffff'
                          : 'var(--color-text-high)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      border:
                        msg.role === 'user'
                          ? 'none'
                          : '1px solid var(--color-outline)',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-text-dim)',
                      marginTop: '4px',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-dim)', marginTop: '60px', padding: '0 20px' }}>
                <span className="material-icons-round" style={{ fontSize: '36px', opacity: 0.5, marginBottom: '8px' }}>
                  forum
                </span>
                <p style={{ fontSize: '13px' }}>
                  No iteration prompts yet. Use the suggestion chips below or type a custom request to collaborate on this song.
                </p>
              </div>
            )}
          </div>

          {/* Quick Suggestions Chips */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--color-outline)',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {quickSuggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(sug)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--color-text-medium)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid var(--color-outline)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              placeholder="e.g. Make the bridge chords more melancholic..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage(inputMessage);
              }}
              style={{
                flex: 1,
                padding: '10px 14px',
                backgroundColor: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-high)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSendMessage(inputMessage)}
              disabled={isSending || !inputMessage.trim()}
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: isSending || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                opacity: isSending || !inputMessage.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px' }}>
                send
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: A/B TESTING SUITE & VERSION HISTORY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* A/B AUDITION DECK */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                swap_horiz
              </span>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                A/B Audio Comparison Engine
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-medium)', marginBottom: '16px', lineHeight: 1.4 }}>
              Select two takes to switch instantaneously between mixes and identify harmonic improvements.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              {/* SLOT A */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: activeSlot === 'A' ? 'rgba(183, 166, 255, 0.08)' : 'var(--color-surface-container)',
                  border: activeSlot === 'A' ? '2px solid var(--color-primary)' : '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    Slot A
                  </span>
                  <button
                    onClick={() => {
                      setActiveSlot('A');
                      if (versionA) {
                        playTrack({
                          chatId: activeChat.id,
                          songName: activeChat.name,
                          version: versionA.version,
                          mp3Url: `/api/audio/${activeChat.id}/${versionA.mp3File}`,
                          midiUrl: `/api/audio/${activeChat.id}/${versionA.midiFile}`,
                          durationSec: versionA.durationSec,
                          lyrics: activeChat.lyrics,
                          bpm: versionA.bpm,
                        });
                      }
                    }}
                    disabled={!versionA}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      backgroundColor: activeSlot === 'A' ? 'var(--color-primary)' : 'var(--color-surface-container-high)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: versionA ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>
                      play_arrow
                    </span>
                    Audition A
                  </button>
                </div>

                <select
                  value={versionA?.version || ''}
                  onChange={(e) => {
                    const v = versions.find(x => x.version === e.target.value);
                    if (v) setVersionA(v);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-outline)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-high)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="">Select Version A...</option>
                  {versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      {v.version} ({v.bpm} BPM - {v.key})
                    </option>
                  ))}
                </select>

                {versionA && (
                  <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--color-text-dim)' }}>
                    Duration: {versionA.durationSec.toFixed(1)}s • {new Date(versionA.createdAt).toLocaleTimeString()}
                  </div>
                )}
              </div>

              {/* SLOT B */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: activeSlot === 'B' ? 'rgba(235, 186, 78, 0.08)' : 'var(--color-surface-container)',
                  border: activeSlot === 'B' ? '2px solid var(--color-accent-amber)' : '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-accent-amber)' }}>
                    Slot B
                  </span>
                  <button
                    onClick={() => {
                      setActiveSlot('B');
                      if (versionB) {
                        playTrack({
                          chatId: activeChat.id,
                          songName: activeChat.name,
                          version: versionB.version,
                          mp3Url: `/api/audio/${activeChat.id}/${versionB.mp3File}`,
                          midiUrl: `/api/audio/${activeChat.id}/${versionB.midiFile}`,
                          durationSec: versionB.durationSec,
                          lyrics: activeChat.lyrics,
                          bpm: versionB.bpm,
                        });
                      }
                    }}
                    disabled={!versionB}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      backgroundColor: activeSlot === 'B' ? 'var(--color-accent-amber)' : 'var(--color-surface-container-high)',
                      color: activeSlot === 'B' ? '#0f0e15' : '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: versionB ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>
                      play_arrow
                    </span>
                    Audition B
                  </button>
                </div>

                <select
                  value={versionB?.version || ''}
                  onChange={(e) => {
                    const v = versions.find(x => x.version === e.target.value);
                    if (v) setVersionB(v);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-outline)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-high)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="">Select Version B...</option>
                  {versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      {v.version} ({v.bpm} BPM - {v.key})
                    </option>
                  ))}
                </select>

                {versionB && (
                  <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--color-text-dim)' }}>
                    Duration: {versionB.durationSec.toFixed(1)}s • {new Date(versionB.createdAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VERSION HISTORY RAIL */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                history
              </span>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                Arrangement Version History
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {versions.map((ver, idx) => (
                <div
                  key={ver.version}
                  style={{
                    padding: '14px 18px',
                    backgroundColor: 'var(--color-surface-container)',
                    border: '1px solid var(--color-outline)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {ver.version}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-high)', fontWeight: 500 }}>
                        {ver.bpm} BPM • {ver.key} • {ver.durationSec.toFixed(0)}s
                      </span>
                      {idx === versions.length - 1 && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            backgroundColor: 'rgba(74, 222, 128, 0.15)',
                            color: '#4ade80',
                            borderRadius: 'var(--radius-pill)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Latest
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                      Compiled {new Date(ver.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() =>
                        playTrack({
                          chatId: activeChat.id,
                          songName: activeChat.name,
                          version: ver.version,
                          mp3Url: `/api/audio/${activeChat.id}/${ver.mp3File}`,
                          midiUrl: `/api/audio/${activeChat.id}/${ver.midiFile}`,
                          durationSec: ver.durationSec,
                          lyrics: activeChat.lyrics,
                          bpm: ver.bpm,
                        })
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 14px',
                        backgroundColor: 'var(--color-surface-container-high)',
                        color: 'var(--color-text-high)',
                        border: '1px solid var(--color-outline)',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '16px' }}>
                        play_arrow
                      </span>
                      Play
                    </button>

                    <a
                      href={`/api/chats/${activeChat.id}/download/${ver.midiFile}`}
                      download
                      style={{
                        padding: '6px',
                        color: 'var(--color-text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                      }}
                      title="Download MIDI"
                    >
                      <span className="material-icons-round" style={{ fontSize: '18px' }}>
                        download
                      </span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  // Cover Feature State
  const [showCoverModal, setShowCoverModal] = useState<boolean>(false);
  const [coverBaseVersion, setCoverBaseVersion] = useState<string>('');
  const [coverInstruction, setCoverInstruction] = useState<string>('');
  const [coverStyle, setCoverStyle] = useState<string>('acoustic');
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
        const mp3File = newV.mp3File || (newV.midiFile ? newV.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat.folderName}_${newV.version}.mp3`);
        playTrack({
          chatId: activeChat.id,
          songName: activeChat.name,
          artist: activeChat.style?.description?.replace(/^Custom import by\s*/i, '') || 'AI Studio Producer',
          album: 'Studio Master Compositions',
          version: newV.version,
          mp3Url: `/api/audio/${activeChat.id}/${mp3File}`,
          midiUrl: newV.midiFile ? `/api/audio/${activeChat.id}/${newV.midiFile}` : '',
          durationSec: newV.durationSec || 180,
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

  const handleCreateCover = async () => {
    if (!activeChat || isRegenerating) return;
    setIsRegenerating(true);
    setShowCoverModal(false);

    const baseVer = coverBaseVersion || (versions[versions.length - 1]?.version || 'v1');
    const nextVer = `v${versions.length + 1}`;
    const coverNote = `Cover of ${baseVer}: ${coverInstruction || 'Stylistic re-arrangement'}`;

    addActivityEvent({
      stage: `Creating ${nextVer} (${coverNote})`,
      status: 'running',
    });

    try {
      const codeRes = await fetch('/api/ai/code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChat.id,
          topic: `${activeChat.name} (Cover)`,
          genre: coverStyle || activeChat.style.genre || 'pop',
          bpm: activeChat.style.bpm || 120,
          key: activeChat.style.key || 'C',
          instructions: `Create a distinct cover arrangement based on version ${baseVer}. Specific changes: ${coverInstruction}`,
        }),
      });

      const codeData = await codeRes.json();

      const renderRes = await fetch('/api/ai/code/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChat.id,
          code: codeData.code,
        }),
      });

      if (renderRes.ok) {
        const data = await renderRes.json();
        setActiveChat(data.chat);
        await refreshChats();
        showSnackbar(`Created Cover Version ${nextVer} successfully!`);
        addActivityEvent({
          stage: `Cover Version ${nextVer} Ready`,
          status: 'done',
        });

        const newV = data.version;
        const mp3File = newV.mp3File || `${activeChat.folderName}_${newV.version}.mp3`;
        playTrack({
          chatId: activeChat.id,
          songName: `${activeChat.name} (Cover)`,
          artist: 'AI Studio Producer',
          album: 'Studio Master Compositions',
          version: newV.version,
          mp3Url: `/api/audio/${activeChat.id}/${mp3File}`,
          midiUrl: newV.midiFile ? `/api/audio/${activeChat.id}/${newV.midiFile}` : '',
          durationSec: newV.durationSec || 180,
          lyrics: activeChat.lyrics,
          bpm: newV.bpm,
        });
      } else {
        const err = await renderRes.json();
        showSnackbar(`Cover creation failed: ${err.error}`);
      }
    } catch (e: any) {
      showSnackbar(`Cover error: ${e.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const versions = activeChat.versions || [];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 24px 100px 24px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
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

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowCoverModal(true)}
            disabled={isRegenerating || versions.length === 0}
            className="btn btn-outlined"
            style={{
              height: '42px',
              padding: '0 16px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>swap_horiz</span>
            <span>Create Cover Version</span>
          </button>

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
      </div>

      {/* COVER VERSION MODAL */}
      {showCoverModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="card animate-pop-in"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#121118',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
                  swap_horiz
                </span>
                <span style={{ fontWeight: 700, fontSize: '16px' }}>Create Cover / Variation Version</span>
              </div>
              <button onClick={() => setShowCoverModal(false)} className="btn-text" style={{ padding: '4px' }}>
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Select an existing version of this song as a baseline, specify your changes, and the AI will compose a new cover version.
            </p>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Baseline Version:
              </label>
              <select
                value={coverBaseVersion || (versions[versions.length - 1]?.version || 'v1')}
                onChange={e => setCoverBaseVersion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#FFF',
                  fontSize: '13px',
                }}
              >
                {versions.map(v => (
                  <option key={v.version} value={v.version}>
                    {v.version} ({v.bpm} BPM · Key {v.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Cover Style Direction:
              </label>
              <select
                value={coverStyle}
                onChange={e => setCoverStyle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#FFF',
                  fontSize: '13px',
                }}
              >
                <option value="acoustic">Acoustic Piano & Warm Strings</option>
                <option value="electronic">High-Energy Electronic / EDM</option>
                <option value="phonk">Drift Phonk / Hard Bass</option>
                <option value="rock">Electric Rock / Overdrive</option>
                <option value="hip-hop">Lo-Fi Boom Bap / Hip-Hop</option>
                <option value="indian">Indian Classical Fusion</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Specific Part to Change:
              </label>
              <textarea
                value={coverInstruction}
                onChange={e => setCoverInstruction(e.target.value)}
                placeholder='e.g. "Add a heavier sub-bass drop on the chorus", "Make the climb faster with 16th snare roll", "Add acoustic arpeggio in Verse 1"...'
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#FFF',
                  fontSize: '13px',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setShowCoverModal(false)} className="btn btn-outlined" style={{ height: '36px', fontSize: '13px' }}>
                Cancel
              </button>
              <button onClick={handleCreateCover} className="btn btn-primary" style={{ height: '36px', fontSize: '13px', fontWeight: 600 }}>
                Generate Cover Master
              </button>
            </div>
          </div>
        </div>
      )}

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
                  className="animate-pop-in"
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

            {/* AI BOT RESPONDING ANIMATION */}
            {isSending && (
              <div
                className="animate-pop-in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  padding: '12px 18px',
                  borderRadius: '16px 16px 16px 2px',
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-primary)',
                  boxShadow: '0 4px 16px rgba(107, 78, 255, 0.2)',
                }}
              >
                <div
                  className="animate-orb-pulse"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--gradient-signature)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '16px', color: '#ffffff' }}>
                    auto_awesome
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                    AI Producer Responding...
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div className="typing-dot-1" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                    <div className="typing-dot-2" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#FF4FA3' }} />
                    <div className="typing-dot-3" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-accent-amber, #FFB020)' }} />
                  </div>
                </div>
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
                        const mp3File = versionA.mp3File || (versionA.midiFile ? versionA.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat.folderName}_${versionA.version}.mp3`);
                        playTrack({
                          chatId: activeChat.id,
                          songName: activeChat.name,
                          artist: activeChat.style?.description?.replace(/^Custom import by\s*/i, '') || 'AI Studio Producer',
                          album: 'Studio Master Compositions',
                          version: versionA.version,
                          mp3Url: `/api/audio/${activeChat.id}/${mp3File}`,
                          midiUrl: versionA.midiFile ? `/api/audio/${activeChat.id}/${versionA.midiFile}` : '',
                          durationSec: versionA.durationSec || 180,
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
                        const mp3File = versionB.mp3File || (versionB.midiFile ? versionB.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat.folderName}_${versionB.version}.mp3`);
                        playTrack({
                          chatId: activeChat.id,
                          songName: activeChat.name,
                          artist: activeChat.style?.description?.replace(/^Custom import by\s*/i, '') || 'AI Studio Producer',
                          album: 'Studio Master Compositions',
                          version: versionB.version,
                          mp3Url: `/api/audio/${activeChat.id}/${mp3File}`,
                          midiUrl: versionB.midiFile ? `/api/audio/${activeChat.id}/${versionB.midiFile}` : '',
                          durationSec: versionB.durationSec || 180,
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
                      onClick={() => {
                        const mp3File = ver.mp3File || (ver.midiFile ? ver.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat.folderName}_${ver.version}.mp3`);
                        playTrack({
                          chatId: activeChat.id,
                          songName: activeChat.name,
                          artist: activeChat.style?.description?.replace(/^Custom import by\s*/i, '') || 'AI Studio Producer',
                          album: 'Studio Master Compositions',
                          version: ver.version,
                          mp3Url: `/api/audio/${activeChat.id}/${mp3File}`,
                          midiUrl: ver.midiFile ? `/api/audio/${activeChat.id}/${ver.midiFile}` : '',
                          durationSec: ver.durationSec || 180,
                          lyrics: activeChat.lyrics,
                          bpm: ver.bpm,
                        });
                      }}
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


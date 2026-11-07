import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  parseLRC,
  convertProjectLyricsToSynced,
  exportToLRC,
  exportToSRT,
  formatTime,
  SyncedLyricLine,
} from '../utils/lrcParser';
import { searchFirstLyricsFromLRCLib } from '../utils/lrclib';
import { parseAudioFileMetadata } from '../utils/id3Parser';

export const ScrollingLyricsPage: React.FC = () => {
  const {
    activeChat,
    activeChatId,
    setActiveChatId,
    chats,
    refreshChats,
    setRoute,
    currentTrack,
    playTrack,
    pauseTrack,
    togglePlayback,
    seekTrack,
    isPlaying,
    currentTime,
    duration,
    showSnackbar,
  } = useApp();

  // Tab mode: 'teleprompter' | 'syncer' | 'custom-import'
  const [mode, setMode] = useState<'teleprompter' | 'syncer' | 'custom-import'>('teleprompter');

  // Custom song import state
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [customLrcText, setCustomLrcText] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('Custom Audio Track');
  const [customArtist, setCustomArtist] = useState<string>('');
  const [customBpm, setCustomBpm] = useState<number>(120);
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  // Synced lyrics line state
  const [syncedLines, setSyncedLines] = useState<SyncedLyricLine[]>([]);
  const [syncIndex, setSyncIndex] = useState<number>(0);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xl'>('large');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [timeOffset, setTimeOffset] = useState<number>(0); // in seconds
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Teleprompter line container ref
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Target song source: currentTrack has priority, then custom import, then activeChat
  const currentSongName = currentTrack?.songName || (customAudioFile ? customTitle : activeChat?.name || 'No Song Selected');
  const currentArtistName = currentTrack?.artist || customArtist || activeChat?.style?.description || '';

  // Load lyrics when activeChat changes, currentTrack changes, or customLrcText changes
  useEffect(() => {
    if (customLrcText.trim()) {
      const parsed = parseLRC(customLrcText);
      setSyncedLines(parsed.lines);
      return;
    }

    if (currentTrack?.syncedLyrics && currentTrack.syncedLyrics.trim()) {
      const parsed = parseLRC(currentTrack.syncedLyrics);
      setSyncedLines(parsed.lines);
      return;
    }

    if (activeChat && Object.keys(activeChat.lyrics).length > 0) {
      const converted = convertProjectLyricsToSynced(
        activeChat.lyrics,
        activeChat.sections || [
          { name: 'Intro', bars: 4 },
          { name: 'Verse 1', bars: 8 },
          { name: 'Chorus 1', bars: 8 },
        ],
        activeChat.style?.bpm || 120
      );
      setSyncedLines(converted);
    } else if (currentTrack && Object.keys(currentTrack.lyrics).length > 0) {
      const converted = convertProjectLyricsToSynced(
        currentTrack.lyrics,
        [
          { name: 'Intro', bars: 4 },
          { name: 'Verse 1', bars: 8 },
          { name: 'Chorus 1', bars: 8 },
        ],
        currentTrack.bpm || 120
      );
      setSyncedLines(converted);
    } else {
      setSyncedLines([
        {
          id: 'cue-ready',
          seconds: 0,
          timestamp: '00:00.000',
          text: 'Select a track from your library or import an audio track to display synchronized lyrics.',
          section: 'Intro',
        },
      ]);
    }
  }, [activeChat, currentTrack, customLrcText]);

  // Determine current active line based on playback time + timeOffset
  const effectiveTime = Math.max(0, currentTime + timeOffset);

  const activeLineIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    // Find the latest line whose start second is <= effectiveTime
    let found = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].seconds >= 0 && syncedLines[i].seconds <= effectiveTime) {
        found = i;
      }
    }
    return found;
  }, [syncedLines, effectiveTime]);

  // Smooth auto-scroll active line to center
  useEffect(() => {
    if (autoScroll && activeLineRef.current && mode === 'teleprompter') {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, autoScroll, mode]);

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard shortcut listener (ENTER for lyrics syncer stamping, SPACE for playback)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Enter') {
        if (mode === 'syncer') {
          e.preventDefault();
          handleSyncCurrentLine();
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        togglePlayback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isPlaying, currentTrack, currentTime, syncIndex, syncedLines]);

  const [isFetchingLrcLib, setIsFetchingLrcLib] = useState(false);

  // Fetch lyrics from LRCLIB
  const handleFetchFromLRCLib = async () => {
    setIsFetchingLrcLib(true);
    const query = currentArtistName ? `${currentSongName} ${currentArtistName}` : currentSongName;
    showSnackbar(`Searching LRCLIB for "${query}"...`);
    try {
      const record = await searchFirstLyricsFromLRCLib({
        track_name: currentSongName,
        artist_name: currentArtistName || undefined,
      });
      if (record && record.syncedLyrics) {
        setCustomLrcText(record.syncedLyrics);
        const parsed = parseLRC(record.syncedLyrics);
        setSyncedLines(parsed.lines);
        showSnackbar(`Loaded ${parsed.lines.length} synchronized lines from LRCLIB (${record.trackName} by ${record.artistName || 'Artist'})`);
      } else if (record && record.plainLyrics) {
        setCustomLrcText(record.plainLyrics);
        const parsed = parseLRC(record.plainLyrics);
        setSyncedLines(parsed.lines);
        showSnackbar(`Loaded plain lyrics from LRCLIB (${record.trackName} by ${record.artistName || 'Artist'}). Ready to sync with Enter key!`);
        setMode('syncer');
      } else {
        showSnackbar(`No matching lyrics found on LRCLIB for "${query}"`);
      }
    } catch (err: any) {
      showSnackbar(`LRCLIB search error: ${err.message}`);
    } finally {
      setIsFetchingLrcLib(false);
    }
  };

  // Lyrics Syncer: Stamp current timestamp to active sync line
  const handleSyncCurrentLine = () => {
    if (syncedLines.length === 0) return;
    const targetIdx = syncIndex < syncedLines.length ? syncIndex : syncedLines.length - 1;
    const stampedSec = parseFloat(currentTime.toFixed(3));

    const updated = [...syncedLines];
    updated[targetIdx] = {
      ...updated[targetIdx],
      seconds: stampedSec,
      timestamp: formatTime(stampedSec, true),
    };

    // Calculate endSeconds for previous line
    if (targetIdx > 0 && updated[targetIdx - 1].seconds >= 0) {
      updated[targetIdx - 1].endSeconds = stampedSec;
    }

    setSyncedLines(updated);

    // Auto-advance to next line
    if (syncIndex < syncedLines.length - 1) {
      setSyncIndex(syncIndex + 1);
    }
  };

  // Nudge line timestamp
  const handleNudge = (index: number, delta: number) => {
    const updated = [...syncedLines];
    const currentSec = updated[index].seconds >= 0 ? updated[index].seconds : currentTime;
    const newSec = Math.max(0, parseFloat((currentSec + delta).toFixed(3)));

    updated[index] = {
      ...updated[index],
      seconds: newSec,
      timestamp: formatTime(newSec, true),
    };
    setSyncedLines(updated);
  };

  // Handle custom audio file selection
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudioFile(file);
      const url = URL.createObjectURL(file);
      setCustomAudioUrl(url);

      const meta = await parseAudioFileMetadata(file);
      const title = meta.title || file.name.replace(/\.[^/.]+$/, '');
      const artist = meta.artist || '';
      setCustomTitle(title);
      if (artist) setCustomArtist(artist);

      // Automatically play this custom track in the audio context
      playTrack({
        chatId: `custom-${Date.now()}`,
        songName: title,
        artist,
        coverArtUrl: meta.coverArtUrl,
        version: 'Custom Take',
        mp3Url: url,
        midiUrl: '',
        durationSec: 180,
        lyrics: {},
        bpm: customBpm,
      });

      showSnackbar(`Loaded audio track: "${title}" ${artist ? `by ${artist}` : ''}`);
    }
  };

  // Handle custom LRC file upload
  const handleLrcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = evt => {
        const text = evt.target?.result as string;
        setCustomLrcText(text);
        const parsed = parseLRC(text);
        setSyncedLines(parsed.lines);
        showSnackbar(`Loaded ${parsed.lines.length} synchronized lyric lines from ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  // Save custom song pair into library (.chats/)
  const handleSaveCustomToLibrary = async () => {
    if (!customAudioFile) {
      showSnackbar('Please select an audio file first');
      return;
    }

    setIsSavingCustom(true);
    try {
      const formData = new FormData();
      formData.append('audio', customAudioFile);
      formData.append('title', customTitle);
      formData.append('artist', customArtist);
      formData.append('bpm', customBpm.toString());

      if (customLrcText) {
        const lrcBlob = new Blob([customLrcText], { type: 'text/plain' });
        formData.append('lrc', lrcBlob, `${customTitle}.lrc`);
      }

      const res = await fetch('/api/custom-song/import', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        await refreshChats();
        setActiveChatId(data.chat.id);
        showSnackbar(`Saved "${data.chat.name}" to your library!`);
        setMode('teleprompter');
      } else {
        const err = await res.json();
        showSnackbar(`Import failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      showSnackbar(`Network error: ${e.message}`);
    } finally {
      setIsSavingCustom(false);
    }
  };

  // Export current synced lines as LRC
  const handleExportLRC = () => {
    const lrcContent = exportToLRC(syncedLines, currentSongName, activeChat?.style?.vocalDelivery || 'Singer');
    const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSongName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
    showSnackbar('Exported synchronized LRC file');
  };

  // Export current synced lines as SRT
  const handleExportSRT = () => {
    const srtContent = exportToSRT(syncedLines);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSongName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    showSnackbar('Exported subtitle SRT file');
  };

  // Save synced lines back to project
  const handleSaveToProject = async () => {
    if (!activeChat) {
      showSnackbar('No active project to save to. Use "Save as Project" instead.');
      return;
    }

    const lrcContent = exportToLRC(syncedLines, activeChat.name);
    try {
      const res = await fetch(`/api/chats/${activeChat.id}/lyrics-sync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lrcContent }),
      });
      if (res.ok) {
        await refreshChats();
        showSnackbar(`Synchronized lyrics saved to "${activeChat.name}"`);
      } else {
        showSnackbar('Failed to update project lyrics');
      }
    } catch (err: any) {
      showSnackbar(`Error: ${err.message}`);
    }
  };

  // Font size styling
  const fontStyles = {
    normal: { fontSize: '18px', lineHeight: '1.6' },
    large: { fontSize: '26px', lineHeight: '1.7' },
    xl: { fontSize: '36px', lineHeight: '1.8' },
  }[fontSize];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px - 100px)',
        backgroundColor: 'var(--color-bg)',
        overflow: 'hidden',
      }}
    >
      {/* SUB-HEADER / CONTROLS STRIP */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--color-outline)',
          backgroundColor: 'var(--color-surface)',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 10,
        }}
      >
        {/* Left: Mode switcher & Song info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--color-container)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
            <button
              onClick={() => setMode('teleprompter')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: mode === 'teleprompter' ? 'var(--color-primary)' : 'transparent',
                color: mode === 'teleprompter' ? '#000000' : 'var(--color-text)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px' }}>subtitles</span>
              Stage Lyrics
            </button>

            <button
              onClick={() => setMode('syncer')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: mode === 'syncer' ? 'var(--color-primary)' : 'transparent',
                color: mode === 'syncer' ? '#000000' : 'var(--color-text)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px' }}>tune</span>
              Lyrics Syncer
            </button>

            <button
              onClick={() => setMode('custom-import')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: mode === 'custom-import' ? 'var(--color-primary)' : 'transparent',
                color: mode === 'custom-import' ? '#000000' : 'var(--color-text)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px' }}>queue_music</span>
              Custom Song Import
            </button>
          </div>

          {/* Project Dropdown Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Song:</span>
            <select
              value={activeChatId || ''}
              onChange={e => {
                const id = e.target.value;
                if (id) {
                  setActiveChatId(id);
                  const selected = chats.find(c => c.id === id);
                  if (selected && selected.versions.length > 0) {
                    const latest = selected.versions[selected.versions.length - 1];
                    const mp3File = latest.mp3File || (latest.midiFile ? latest.midiFile.replace(/\.mid$/, '.mp3') : `${selected.folderName}_${latest.version || 'v1'}.mp3`);
                    playTrack({
                      chatId: selected.id,
                      songName: selected.name,
                      version: latest.version,
                      mp3Url: `/api/audio/${selected.id}/${mp3File}`,
                      midiUrl: latest.midiFile ? `/api/audio/${selected.id}/${latest.midiFile}` : '',
                      durationSec: latest.durationSec || 180,
                      lyrics: selected.lyrics,
                      bpm: selected.style.bpm || 120,
                    });
                  }
                }
              }}
              style={{
                backgroundColor: 'var(--color-surface-container)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: '13px',
                maxWidth: '220px',
              }}
            >
              <option value="">{customAudioFile ? customTitle : '-- Choose Library Track --'}</option>
              {chats.map(chat => (
                <option key={chat.id} value={chat.id}>
                  {chat.name} ({chat.style.genre})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Teleprompter & Display Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {mode === 'teleprompter' && (
            <>
              {/* Font Size Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Size:</span>
                {(['normal', 'large', 'xl'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--color-outline)',
                      backgroundColor: fontSize === size ? 'var(--color-primary)' : 'transparent',
                      color: fontSize === size ? '#000' : 'var(--color-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Auto Scroll Toggle */}
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`btn ${autoScroll ? 'btn-tonal' : 'btn-outlined'}`}
                style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                title="Toggle smooth auto-scrolling to active line"
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>
                  {autoScroll ? 'lock' : 'lock_open'}
                </span>
                Auto-Follow
              </button>

              {/* Time Offset Fine-Tune */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setTimeOffset(prev => prev - 0.2)}
                  style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--color-outline)', borderRadius: '4px', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
                  title="Shift lyrics earlier (-0.2s)"
                >
                  -
                </button>
                <span style={{ fontSize: '11px', minWidth: '46px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {timeOffset > 0 ? `+${timeOffset.toFixed(1)}s` : `${timeOffset.toFixed(1)}s`}
                </span>
                <button
                  onClick={() => setTimeOffset(prev => prev + 0.2)}
                  style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--color-outline)', borderRadius: '4px', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
                  title="Shift lyrics later (+0.2s)"
                >
                  +
                </button>
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="btn-text"
                style={{ width: '32px', height: '32px', padding: 0 }}
                title="Toggle Fullscreen Stage Display"
              >
                <span className="material-icons-round">
                  {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>
            </>
          )}

          {/* Export & LRCLIB Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* LRCLIB Fetch Button */}
            <button
              onClick={handleFetchFromLRCLib}
              disabled={isFetchingLrcLib}
              className="btn btn-outlined"
              style={{ height: '32px', padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Search and download synchronized lyrics from LRCLIB"
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>cloud_download</span>
              <span>{isFetchingLrcLib ? 'Searching...' : 'Fetch LRCLIB'}</span>
            </button>

            <button
              onClick={handleExportLRC}
              className="btn btn-outlined"
              style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
              title="Export standard synchronized .lrc file"
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>file_download</span>
              LRC
            </button>
            <button
              onClick={handleExportSRT}
              className="btn btn-outlined"
              style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
              title="Export subtitle .srt file"
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>subtitles</span>
              SRT
            </button>
            {activeChat && (
              <button
                onClick={handleSaveToProject}
                className="btn btn-primary"
                style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                title="Save synchronized timing to current project"
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>save</span>
                Save Sync
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEWPORT AREA ACCORDING TO MODE */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* MODE 1: SCROLLING TELEPROMPTER */}
        {mode === 'teleprompter' && (
          <div
            ref={containerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '60px 24px 180px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              scrollBehavior: 'smooth',
            }}
          >
            <div style={{ width: '100%', maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {syncedLines.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                const isPast = activeLineIndex !== -1 && idx < activeLineIndex;

                return (
                  <div
                    key={line.id}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => {
                      if (line.seconds >= 0) {
                        seekTrack(line.seconds);
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: isActive ? '18px 24px' : '10px 20px',
                      borderRadius: 'var(--radius-md)',
                      cursor: line.seconds >= 0 ? 'pointer' : 'default',
                      transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
                      backgroundColor: isActive ? 'rgba(110, 68, 255, 0.16)' : 'transparent',
                      borderLeft: isActive ? '4px solid var(--color-primary)' : '4px solid transparent',
                      boxShadow: isActive ? '0 0 24px rgba(110, 68, 255, 0.28)' : 'none',
                      opacity: isActive ? 1 : isPast ? 0.45 : 0.75,
                      transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    {/* Timestamp & Section Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {line.section && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          }}
                        >
                          [{line.section}]
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        }}
                      >
                        {line.timestamp}
                      </span>
                    </div>

                    {/* Lyric Text */}
                    <div
                      style={{
                        ...fontStyles,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#FFFFFF' : 'var(--color-text)',
                        textShadow: isActive ? '0 0 12px rgba(255, 255, 255, 0.3)' : 'none',
                      }}
                    >
                      {line.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE 2: LYRICS SYNCER (INTERACTIVE STAMPING) */}
        {mode === 'syncer' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Deck: Giant Tap-to-Sync Control */}
            <div
              style={{
                width: '380px',
                borderRight: '1px solid var(--color-outline)',
                backgroundColor: 'var(--color-surface)',
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Live Lyrics Syncer</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                  Play the track and press the <strong>ENTER</strong> key to stamp timestamps line by line. Spacebar toggles play and pause!
                </p>

                {/* Current Playback Counter */}
                <div
                  style={{
                    backgroundColor: '#0E0D14',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    textAlign: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                    Current Time
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {formatTime(currentTime, true)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Sync Progress: Line {Math.min(syncIndex + 1, syncedLines.length)} of {syncedLines.length}
                  </div>
                </div>

                {/* Target Line Preview */}
                <div
                  style={{
                    backgroundColor: 'rgba(110, 68, 255, 0.08)',
                    border: '1px solid var(--color-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Active Line to Sync
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', minHeight: '44px' }}>
                    {syncedLines[syncIndex]?.text || 'All lines synced!'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                    Next up: {syncedLines[syncIndex + 1]?.text || 'End of song'}
                  </div>
                </div>
              </div>

              {/* Big Pulsing Sync Button with ENTER key */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleSyncCurrentLine}
                  className="btn btn-primary"
                  style={{
                    height: '56px',
                    fontSize: '15px',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(110, 68, 255, 0.4)',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '22px' }}>keyboard_return</span>
                  <span>SYNC ACTIVE LINE [ENTER]</span>
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSyncIndex(0)}
                    className="btn btn-outlined"
                    style={{ flex: 1, height: '38px', fontSize: '12px', justifyContent: 'center' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '16px' }}>restart_alt</span>
                    Start Over
                  </button>
                  <button
                    onClick={togglePlayback}
                    className="btn btn-tonal"
                    style={{ flex: 1, height: '38px', fontSize: '12px', justifyContent: 'center' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '18px' }}>
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                    {isPlaying ? 'Pause [Space]' : 'Play [Space]'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Deck: Interactive Line-by-Line Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {syncedLines.map((line, idx) => {
                  const isTarget = idx === syncIndex;
                  const isSynced = line.seconds >= 0;

                  return (
                    <div
                      key={line.id}
                      onClick={() => setSyncIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isTarget
                          ? 'rgba(110, 68, 255, 0.16)'
                          : 'var(--color-surface)',
                        border: isTarget
                          ? '1px solid var(--color-primary)'
                          : '1px solid var(--color-outline)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            minWidth: '24px',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {idx + 1}.
                        </span>

                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: isSynced ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                            color: isSynced ? 'var(--color-success)' : 'var(--color-text-secondary)',
                            minWidth: '76px',
                            textAlign: 'center',
                          }}
                        >
                          {line.timestamp}
                        </span>

                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: isTarget ? 600 : 400,
                            color: isTarget ? '#FFFFFF' : 'var(--color-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {line.text}
                        </span>
                      </div>

                      {/* Line Nudge Tools */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleNudge(idx, -0.1);
                          }}
                          className="btn-text"
                          style={{ width: '28px', height: '28px', padding: 0, fontSize: '11px' }}
                          title="Nudge earlier (-0.1s)"
                        >
                          -0.1s
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleNudge(idx, 0.1);
                          }}
                          className="btn-text"
                          style={{ width: '28px', height: '28px', padding: 0, fontSize: '11px' }}
                          title="Nudge later (+0.1s)"
                        >
                          +0.1s
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (line.seconds >= 0) seekTrack(line.seconds);
                          }}
                          className="btn-text"
                          style={{ width: '28px', height: '28px', padding: 0 }}
                          title="Seek and audition this line"
                        >
                          <span className="material-icons-round" style={{ fontSize: '16px' }}>play_circle</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: CUSTOM SONG IMPORT (.MP3 + .LRC PAIRING) */}
        {mode === 'custom-import' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
                  Import Custom Audio & Synced Lyrics
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Bring in your own song by pairing an audio track (<code>.mp3</code>, <code>.wav</code>) with an existing synchronized <code>.lrc</code> file or plain text lyrics to sync.
                </p>
              </div>

              {/* Step 1: Upload Audio File */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    1
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Audio File (.mp3, .wav, .ogg)</h3>
                </div>

                <div
                  style={{
                    border: '2px dashed var(--color-outline)',
                    borderRadius: 'var(--radius-md)',
                    padding: '28px',
                    textAlign: 'center',
                    backgroundColor: customAudioFile ? 'rgba(74, 222, 128, 0.05)' : 'transparent',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '40px', color: 'var(--color-primary)', marginBottom: '8px' }}>
                    audio_file
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                    {customAudioFile ? customAudioFile.name : 'Select or drop your song audio'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                    Supports MP3, WAV, OGG, and M4A audio files
                  </div>
                  <label className="btn btn-outlined" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                    <span className="material-icons-round" style={{ fontSize: '18px' }}>file_upload</span>
                    Browse Audio File
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* Step 2: Upload or Paste Synced Lyrics (.lrc) */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    2
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Lyrics (.lrc file or raw text)</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label className="btn btn-outlined" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                      <span className="material-icons-round" style={{ fontSize: '18px' }}>upload_file</span>
                      Upload .LRC / .TXT
                      <input type="file" accept=".lrc,.txt" onChange={handleLrcUpload} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <textarea
                    rows={6}
                    value={customLrcText}
                    onChange={e => setCustomLrcText(e.target.value)}
                    placeholder="[00:12.50]Paste standard LRC lyrics here or raw lines...
[00:15.20]Each timestamp automatically synchronizes with the stage teleprompter!"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-outline)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      color: 'var(--color-text)',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              {/* Step 3: Track Metadata & Save to Project Library */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    3
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Save to Library (Optional)</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Song Title
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      placeholder="e.g. Bohemian Rhapsody"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Artist Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={customArtist}
                      onChange={e => setCustomArtist(e.target.value)}
                      placeholder="e.g. Queen"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button
                    onClick={() => setMode('teleprompter')}
                    className="btn btn-tonal"
                    style={{ height: '44px', padding: '0 20px' }}
                  >
                    <span className="material-icons-round">play_arrow</span>
                    Preview Scrolling Now
                  </button>

                  <button
                    onClick={handleSaveCustomToLibrary}
                    disabled={!customAudioFile || isSavingCustom}
                    className="btn btn-primary"
                    style={{ height: '44px', padding: '0 24px', fontWeight: 700 }}
                  >
                    <span className="material-icons-round">bookmark_add</span>
                    {isSavingCustom ? 'Saving...' : 'Save as Project in Library'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


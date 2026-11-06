import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const PersistentPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlayback,
    seekTrack,
    setPlayerVolume,
    setRoute,
    setActiveChatId,
  } = useApp();

  const [showVolume, setShowVolume] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '880px',
        height: '72px',
        backgroundColor: 'rgba(22, 21, 29, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--color-outline)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-l3)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '16px',
        zIndex: 1000,
      }}
    >
      {/* 48px Gradient Cover */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--gradient-signature)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#FFF',
        }}
      >
        <span className="material-icons-round" style={{ fontSize: '24px' }}>graphic_eq</span>
      </div>

      {/* Title & Metadata */}
      <div style={{ minWidth: '140px', maxWidth: '200px', overflow: 'hidden' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {currentTrack.songName}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {currentTrack.version} · {currentTrack.bpm} BPM
        </div>
      </div>

      {/* Transport Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="btn-text"
          onClick={() => seekTrack(Math.max(0, currentTime - 10))}
          title="Rewind 10s"
          style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
        >
          <span className="material-icons-round">replay_10</span>
        </button>

        <button
          onClick={togglePlayback}
          title={isPlaying ? 'Pause' : 'Play (Space)'}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'var(--gradient-signature)',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--gradient-glow)',
            transition: 'transform 0.15s ease',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span className="material-icons-round" style={{ fontSize: '26px' }}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        <button
          className="btn-text"
          onClick={() => seekTrack(Math.min(duration, currentTime + 10))}
          title="Forward 10s"
          style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
        >
          <span className="material-icons-round">forward_10</span>
        </button>
      </div>

      {/* Scrubber & Mono Timestamps */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)', minWidth: '36px' }}>
          {formatTime(currentTime)}
        </span>
        <div
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            seekTrack(clickPos * duration);
          }}
          style={{
            flex: 1,
            height: '6px',
            backgroundColor: 'var(--color-container-high)',
            borderRadius: '3px',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'var(--gradient-signature)',
              borderRadius: '3px',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: '-5px',
                top: '-3px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 6px rgba(0,0,0,0.4)',
              }}
            />
          </div>
        </div>
        <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)', minWidth: '36px' }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Auxiliary Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
        {/* Volume popover toggle */}
        <button
          className="btn-text"
          onClick={() => setShowVolume(prev => !prev)}
          title="Volume"
          style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
        >
          <span className="material-icons-round">
            {volume === 0 ? 'volume_off' : 'volume_up'}
          </span>
        </button>

        {showVolume && (
          <div
            style={{
              position: 'absolute',
              bottom: '50px',
              right: '40px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              boxShadow: 'var(--shadow-l2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '40px',
              height: '120px',
            }}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={e => setPlayerVolume(parseFloat(e.target.value))}
              style={{
                transform: 'rotate(-90deg)',
                width: '90px',
                marginTop: '45px',
                accentColor: 'var(--color-primary)',
              }}
            />
          </div>
        )}

        {/* Download Button */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-text"
            onClick={() => setShowDownloadMenu(prev => !prev)}
            title="Download track assets"
            style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
          >
            <span className="material-icons-round">download</span>
          </button>

          {showDownloadMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '50px',
                right: '0',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-outline)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 0',
                boxShadow: 'var(--shadow-l2)',
                minWidth: '180px',
                zIndex: 1100,
              }}
            >
              <a
                href={currentTrack.mp3Url}
                download
                className="btn-text"
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 16px', borderRadius: 0 }}
                onClick={() => setShowDownloadMenu(false)}
              >
                <span>MP3 Audio</span>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Audio</span>
              </a>
              <a
                href={currentTrack.midiUrl}
                download
                className="btn-text"
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 16px', borderRadius: 0 }}
                onClick={() => setShowDownloadMenu(false)}
              >
                <span>Standard MIDI</span>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>.mid</span>
              </a>
            </div>
          )}
        </div>

        {/* Expand to Result Page */}
        <button
          className="btn-text"
          onClick={() => {
            setActiveChatId(currentTrack.chatId);
            setRoute('chat');
          }}
          title="Open Result & Vocal Studio"
          style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
        >
          <span className="material-icons-round">open_in_full</span>
        </button>
      </div>
    </div>
  );
};


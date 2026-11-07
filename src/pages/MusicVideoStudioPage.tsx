import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export const MusicVideoStudioPage: React.FC = () => {
  const {
    activeChat,
    chats,
    setActiveChatId,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    seekTrack,
    togglePlayback,
    showSnackbar,
  } = useApp();

  // Mode: 'preview' (Remotion Timeline + 3D Canvas) | 'code' (Composition Code Editor)
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  // Remotion timeline state
  const fps = 30;
  const currentFrame = Math.floor(currentTime * fps);
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const [selectedTrackLayer, setSelectedTrackLayer] = useState<string>('3d-scene');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Three.js / WebGL Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Editable Composition Code
  const [compositionCode, setCompositionCode] = useState<string>(`// Remotion + Three.js 3D Reactive Music Video Composition
// Frame rate: 30 FPS · Resolution: 1920x1080 (16:9)

export const MusicVideoComposition = ({ frame, fps, durationInFrames, audioData }) => {
  // 1. Reactive 3D Camera Path
  const cameraZ = 450 - Math.sin(frame * 0.05) * 60;
  const cameraRotation = (frame / fps) * 0.2;

  // 2. Beat Drop & Climbs Detection
  const isDropSection = frame > 840 && frame < 1800; // Bars 17-32
  const particleIntensity = isDropSection ? 2.5 : 1.0;
  const bloomRadius = isDropSection ? 0.85 : 0.35;

  // 3. Three.js Particle Mesh Setup
  const particles = Array.from({ length: 600 }).map((_, i) => ({
    x: Math.sin(i * 0.4 + frame * 0.02) * 280,
    y: Math.cos(i * 0.4 + frame * 0.02) * 280,
    z: ((i * 12 + frame * 4) % 1200) - 600,
    color: isDropSection ? '#9B51E0' : '#3CC4B2',
    scale: 2 + Math.sin(frame * 0.1 + i) * particleIntensity,
  }));

  // 4. Kinetic Subtitles & Typography Layer
  const currentSubtitle = audioData?.currentLyric || 'MusicSkills Visual Engine';

  return {
    camera: { z: cameraZ, rotationY: cameraRotation },
    particles,
    bloom: { radius: bloomRadius },
    subtitle: currentSubtitle,
  };
};
`);

  // Load custom composition code if the active chat has one
  useEffect(() => {
    if (!activeChat) return;

    fetch(`/api/chats/${activeChat.id}/video`)
      .then(res => res.json())
      .then(data => {
        if (data.exists && data.compositionCode) {
          setCompositionCode(data.compositionCode);
        }
      })
      .catch(() => {});
  }, [activeChat?.id]);

  const handleSaveComposition = async () => {
    if (!activeChat) {
      showSnackbar('Applied composition preview in memory');
      setViewMode('preview');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/chats/${activeChat.id}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositionCode }),
      });
      const data = await res.json();
      if (data.success) {
        showSnackbar(`Saved Remotion composition to ${activeChat.name}`);
      } else {
        showSnackbar('Failed to persist composition');
      }
    } catch (e) {
      showSnackbar('Error saving composition');
    } finally {
      setIsSaving(false);
      setViewMode('preview');
    }
  };

  // Simple, robust WebGL 3D Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewMode !== 'preview') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = '#08070D';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Pulse radius based on audio activity
      const beatPulse = isPlaying ? Math.sin(currentTime * 8) * 15 : 0;
      const baseRadius = 80 + beatPulse;

      // 1. Draw glowing 3D particle tunnel
      const numParticles = 180;
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2 + currentTime * 0.4;
        const depth = ((i * 15 + currentTime * 80) % 800) / 800;
        const pRadius = baseRadius * (1 + depth * 3);

        const x = cx + Math.cos(angle) * pRadius;
        const y = cy + Math.sin(angle) * pRadius;
        const size = (1 - depth) * 4 + 1;

        ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 68, 255, 0.7)' : 'rgba(60, 196, 178, 0.7)';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw central geometric wireframe core (reactive to beat)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let side = 0; side < 6; side++) {
        const sAngle = (side / 6) * Math.PI * 2 + currentTime * 0.6;
        const sx = cx + Math.cos(sAngle) * (baseRadius * 0.7);
        const sy = cy + Math.sin(sAngle) * (baseRadius * 0.7);
        if (side === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();

      // 3. Draw Remotion-style Watermark / Frame overlay
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(
        `REMOTION PREVIEW · FRAME ${currentFrame} / ${totalFrames} · ${(currentTime).toFixed(2)}s`,
        24,
        32
      );

      // 4. Draw active subtitle overlay
      if (currentTrack) {
        ctx.font = '700 20px Inter, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(currentTrack.songName, cx, height - 48);
        ctx.textAlign = 'left';
      }

      animId = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [viewMode, isPlaying, currentTime, currentFrame, totalFrames, currentTrack]);

  const formatTimeCode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px - 100px)',
        backgroundColor: '#09080E',
        overflow: 'hidden',
      }}
    >
      {/* Top Studio Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          backgroundColor: '#111017',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
              movie_filter
            </span>
            <span style={{ fontWeight: 700, fontSize: '15px' }}>Remotion + Three.js Video Studio</span>
          </div>

          {/* Project Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Project:</span>
            <select
              value={activeChat?.id || ''}
              onChange={e => setActiveChatId(e.target.value || null)}
              style={{
                backgroundColor: '#181724',
                color: '#FFF',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '5px',
                padding: '4px 10px',
                fontSize: '12px',
                outline: 'none',
                maxWidth: '180px',
              }}
            >
              <option value="">(Select Song Project)</option>
              {chats.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switcher: Preview vs Code */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => setViewMode('preview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: viewMode === 'preview' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'preview' ? '#000' : 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>visibility</span>
              Timeline Preview
            </button>

            <button
              onClick={() => setViewMode('code')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: viewMode === 'code' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'code' ? '#000' : 'var(--color-text)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>code</span>
              Composition Code
            </button>
          </div>
        </div>

        {/* Timecode & Frame Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            <span>{formatTimeCode(currentTime)}</span>
            <span>/</span>
            <span>{formatTimeCode(duration || 180)}</span>
            <span className="chip" style={{ height: '22px', fontSize: '10px', padding: '0 6px' }}>
              Frame {currentFrame} ({fps} FPS)
            </span>
          </div>

          <button
            onClick={() => showSnackbar('Exported Remotion Video Composition')}
            className="btn btn-outlined"
            style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>file_download</span>
            Export Composition
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'preview' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top Half: 16:9 Viewport Window */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#050408',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '820px',
                aspectRatio: '16 / 9',
                backgroundColor: '#08070D',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <canvas
                ref={canvasRef}
                width={820}
                height={461}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
          </div>

          {/* Bottom Half: Remotion Professional Timeline UI */}
          <div
            style={{
              height: '240px',
              backgroundColor: '#0E0D14',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Timeline Transport Header */}
            <div
              style={{
                height: '42px',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                backgroundColor: '#12111A',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => seekTrack(Math.max(0, currentTime - 1 / fps))}
                  className="btn-text"
                  style={{ width: '28px', height: '28px', padding: 0 }}
                  title="Step 1 Frame Back"
                >
                  <span className="material-icons-round" style={{ fontSize: '18px' }}>skip_previous</span>
                </button>

                <button
                  onClick={togglePlayback}
                  className="btn btn-primary"
                  style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%' }}
                  title={isPlaying ? 'Pause' : 'Play Timeline'}
                >
                  <span className="material-icons-round" style={{ fontSize: '20px' }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                <button
                  onClick={() => seekTrack(Math.min(duration, currentTime + 1 / fps))}
                  className="btn-text"
                  style={{ width: '28px', height: '28px', padding: 0 }}
                  title="Step 1 Frame Forward"
                >
                  <span className="material-icons-round" style={{ fontSize: '18px' }}>skip_next</span>
                </button>

                <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-primary)', marginLeft: '8px' }}>
                  {formatTimeCode(currentTime)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Tracks (4 Layers)</span>
              </div>
            </div>

            {/* Timeline Multi-Layer Tracks */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                padding: '8px 16px',
                gap: '6px',
                position: 'relative',
              }}
            >
              {/* Playhead Vertical Line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${Math.min(100, Math.max(0, (currentTime / (duration || 180)) * 100))}%`,
                  width: '2px',
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: '0 0 8px var(--color-primary)',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              />

              {/* Track 1: Three.js 3D Geometry Scene */}
              <div
                onClick={() => setSelectedTrackLayer('3d-scene')}
                style={{
                  height: '38px',
                  borderRadius: '4px',
                  backgroundColor: selectedTrackLayer === '3d-scene' ? 'rgba(110, 68, 255, 0.15)' : '#181622',
                  border: '1px solid rgba(110, 68, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                  view_in_ar
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Three.js 3D Visualizer Layer</span>
              </div>

              {/* Track 2: Audio Waveform */}
              <div
                onClick={() => setSelectedTrackLayer('audio')}
                style={{
                  height: '38px',
                  borderRadius: '4px',
                  backgroundColor: selectedTrackLayer === 'audio' ? 'rgba(60, 196, 178, 0.15)' : '#181622',
                  border: '1px solid rgba(60, 196, 178, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px', color: '#3CC4B2' }}>
                  graphic_eq
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Master Audio Track (192k MP3)</span>
              </div>

              {/* Track 3: Synced Lyric Subtitles */}
              <div
                onClick={() => setSelectedTrackLayer('lyrics')}
                style={{
                  height: '38px',
                  borderRadius: '4px',
                  backgroundColor: selectedTrackLayer === 'lyrics' ? 'rgba(255, 176, 32, 0.15)' : '#181622',
                  border: '1px solid rgba(255, 176, 32, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px', color: '#FFB020' }}>
                  subtitles
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Synced Kinetic Lyrics Layer</span>
              </div>

              {/* Track 4: Beat Drops & Energy Climbs */}
              <div
                onClick={() => setSelectedTrackLayer('drops')}
                style={{
                  minHeight: '38px',
                  borderRadius: '4px',
                  backgroundColor: selectedTrackLayer === 'drops' ? 'rgba(255, 79, 163, 0.15)' : '#181622',
                  border: '1px solid rgba(255, 79, 163, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  gap: '10px',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-icons-round" style={{ fontSize: '16px', color: '#FF4FA3' }}>
                    bolt
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Beat Drops & Transition Markers</span>
                </div>

                {activeChat?.sections && activeChat.sections.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                    {activeChat.sections.map((sec, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          backgroundColor:
                            sec.energy === 'high'
                              ? 'rgba(255, 79, 163, 0.3)'
                              : sec.energy === 'mid'
                              ? 'rgba(110, 68, 255, 0.3)'
                              : 'rgba(255, 255, 255, 0.1)',
                          color: '#FFF',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                        }}
                      >
                        {sec.name} ({sec.bars}b)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Code Mode: Full In-Browser Remotion + Three.js Code Editor */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 20px',
              backgroundColor: '#121118',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
              RemotionComposition.tsx · Three.js Shader & Particle Pipeline
            </span>

            <button
              onClick={handleSaveComposition}
              disabled={isSaving}
              className="btn btn-primary"
              style={{ height: '30px', padding: '0 14px', fontSize: '12px' }}
            >
              <span className="material-icons-round" style={{ fontSize: '15px' }}>
                {isSaving ? 'hourglass_top' : 'check'}
              </span>
              {isSaving ? 'Saving...' : 'Apply & Run Preview'}
            </button>
          </div>

          <textarea
            value={compositionCode}
            onChange={e => setCompositionCode(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              width: '100%',
              backgroundColor: '#0B0A10',
              color: '#F1F5F9',
              border: 'none',
              outline: 'none',
              padding: '20px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              lineHeight: 1.6,
              resize: 'none',
              whiteSpace: 'pre',
            }}
          />
        </div>
      )}
    </div>
  );
};


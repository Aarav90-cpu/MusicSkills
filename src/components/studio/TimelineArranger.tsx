import React, { useRef } from 'react';
import { StudioTrack, StudioClip } from '../../types';

interface TimelineArrangerProps {
  tracks: StudioTrack[];
  clips: StudioClip[];
  totalBars: number;
  currentBar: number;
  currentStepIndex: number;
  isPlaying: boolean;
  onAddClip: (trackId: string, startBar: number) => void;
  onUpdateClip: (clipId: string, updates: Partial<StudioClip>) => void;
  onDeleteClip: (clipId: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onChangeVolume: (trackId: string, volume: number) => void;
  onChangePan: (trackId: string, pan: number) => void;
  onScrubBar: (bar: number) => void;
  onUploadAudioSample: (e: React.ChangeEvent<HTMLInputElement>, trackId: string, startBar: number) => void;
}

export const TimelineArranger: React.FC<TimelineArrangerProps> = ({
  tracks,
  clips,
  totalBars,
  currentBar,
  currentStepIndex,
  isPlaying,
  onAddClip,
  onUpdateClip,
  onDeleteClip,
  onToggleMute,
  onToggleSolo,
  onChangeVolume,
  onChangePan,
  onScrubBar,
  onUploadAudioSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadTarget = useRef<{ trackId: string; startBar: number } | null>(null);

  // Bar width in pixels
  const BAR_WIDTH = 56;

  const handleBarClick = (bar: number) => {
    onScrubBar(bar);
  };

  const handleLaneClick = (trackId: string, bar: number, e: React.MouseEvent) => {
    e.stopPropagation();
    // Check if an existing clip is at this bar
    const existing = clips.find(c => c.trackId === trackId && bar >= c.startBar && bar < c.startBar + c.durationBars);
    if (!existing) {
      onAddClip(trackId, bar);
    }
  };

  const triggerUploadForLane = (trackId: string, bar: number) => {
    pendingUploadTarget.current = { trackId, startBar: bar };
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-outline)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowX: 'auto',
      }}
    >
      {/* Hidden file input for sample upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.flac"
        style={{ display: 'none' }}
        onChange={e => {
          if (pendingUploadTarget.current) {
            onUploadAudioSample(e, pendingUploadTarget.current.trackId, pendingUploadTarget.current.startBar);
            pendingUploadTarget.current = null;
          }
        }}
      />

      {/* Arranger Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
            view_timeline
          </span>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
            Song-Editor & Playlist (LMMS Arranger)
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: 'var(--color-container)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-text-secondary)',
              fontWeight: 600,
            }}
          >
            {totalBars} Bars Total
          </span>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Click bar ruler to scrub · Click track lane to place pattern/clip · Drag or resize duration
        </div>
      </div>

      {/* Timeline Ruler & Tracks Container */}
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--color-outline)', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Ruler Row */}
        <div style={{ display: 'flex', backgroundColor: 'var(--color-container)', borderBottom: '1px solid var(--color-outline)', height: '28px' }}>
          {/* Track Header Spacer */}
          <div style={{ width: '220px', flexShrink: 0, padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Track Lane
          </div>

          {/* Bar Ruler Units */}
          <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
            {Array.from({ length: totalBars }).map((_, idx) => {
              const barNum = idx + 1;
              const isCurrent = isPlaying && currentBar === barNum;

              return (
                <div
                  key={barNum}
                  onClick={() => handleBarClick(barNum)}
                  style={{
                    width: `${BAR_WIDTH}px`,
                    flexShrink: 0,
                    height: '100%',
                    borderRight: '1px solid var(--color-outline)',
                    fontSize: '11px',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    backgroundColor: isCurrent ? 'rgba(124, 77, 255, 0.12)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '6px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title={`Jump to Bar ${barNum}`}
                >
                  {barNum}
                </div>
              );
            })}

            {/* Playhead Indicator Line */}
            {isPlaying && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${((currentStepIndex) / 16) * BAR_WIDTH}px`,
                  width: '2px',
                  backgroundColor: '#ff1744',
                  boxShadow: '0 0 6px #ff1744',
                  zIndex: 10,
                  pointerEvents: 'none',
                  transition: 'left 0.05s linear',
                }}
              />
            )}
          </div>
        </div>

        {/* Track Lanes */}
        {tracks.map(track => {
          const trackClips = clips.filter(c => c.trackId === track.id);

          return (
            <div
              key={track.id}
              style={{
                display: 'flex',
                height: '56px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                backgroundColor: track.isMuted ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
              }}
            >
              {/* Track Left Controls */}
              <div
                style={{
                  width: '220px',
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRight: '1px solid var(--color-outline)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                {/* Track Name & Mute/Solo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: track.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {track.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {track.type === 'audio' && (
                      <button
                        className="btn-text"
                        onClick={() => triggerUploadForLane(track.id, 1)}
                        title="Upload audio clip (.mp3, .wav)"
                        style={{ width: '22px', height: '22px', padding: 0 }}
                      >
                        <span className="material-icons-round" style={{ fontSize: '15px', color: 'var(--color-primary)' }}>
                          file_upload
                        </span>
                      </button>
                    )}

                    <button
                      className="btn-text"
                      onClick={() => onToggleMute(track.id)}
                      style={{
                        width: '22px',
                        height: '22px',
                        padding: 0,
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        backgroundColor: track.isMuted ? 'var(--color-warning)' : 'rgba(255, 255, 255, 0.05)',
                        color: track.isMuted ? '#000000' : 'var(--color-text-secondary)',
                      }}
                      title={track.isMuted ? 'Unmute track' : 'Mute track'}
                    >
                      M
                    </button>
                    <button
                      className="btn-text"
                      onClick={() => onToggleSolo(track.id)}
                      style={{
                        width: '22px',
                        height: '22px',
                        padding: 0,
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        backgroundColor: track.isSolo ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                        color: track.isSolo ? '#ffffff' : 'var(--color-text-secondary)',
                      }}
                      title={track.isSolo ? 'Un-solo track' : 'Solo track'}
                    >
                      S
                    </button>
                  </div>
                </div>

                {/* Track Volume Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-icons-round" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    volume_up
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={track.volume}
                    onChange={e => onChangeVolume(track.id, parseFloat(e.target.value))}
                    style={{ flex: 1, height: '4px', cursor: 'pointer' }}
                    title={`Volume: ${Math.round(track.volume * 100)}%`}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', width: '26px', textAlign: 'right' }}>
                    {Math.round(track.volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Lane Timeline Bars */}
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  position: 'relative',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Background Grid Cells */}
                {Array.from({ length: totalBars }).map((_, idx) => {
                  const barNum = idx + 1;
                  return (
                    <div
                      key={barNum}
                      onClick={e => handleLaneClick(track.id, barNum, e)}
                      style={{
                        width: `${BAR_WIDTH}px`,
                        flexShrink: 0,
                        height: '100%',
                        borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                        cursor: 'pointer',
                      }}
                      title={`Click to place clip at Bar ${barNum}`}
                    />
                  );
                })}

                {/* Render Pattern & Audio Clips */}
                {trackClips.map(clip => {
                  const leftPx = (clip.startBar - 1) * BAR_WIDTH;
                  const widthPx = clip.durationBars * BAR_WIDTH - 2;

                  return (
                    <div
                      key={clip.id}
                      style={{
                        position: 'absolute',
                        left: `${leftPx}px`,
                        width: `${widthPx}px`,
                        top: '4px',
                        bottom: '4px',
                        backgroundColor: clip.color || track.color,
                        borderRadius: '6px',
                        padding: '4px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: 'var(--shadow-l1)',
                        cursor: 'grab',
                        userSelect: 'none',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {clip.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                          {/* Duration adjustments */}
                          <button
                            className="btn-text"
                            onClick={() => onUpdateClip(clip.id, { durationBars: Math.max(1, clip.durationBars - 1) })}
                            style={{ width: '16px', height: '16px', padding: 0, fontSize: '10px', color: '#ffffff' }}
                            title="Shorten clip by 1 bar"
                          >
                            -
                          </button>
                          <span style={{ fontSize: '10px', color: '#ffffff', padding: '0 2px' }}>
                            {clip.durationBars}b
                          </span>
                          <button
                            className="btn-text"
                            onClick={() => onUpdateClip(clip.id, { durationBars: Math.min(16, clip.durationBars + 1) })}
                            style={{ width: '16px', height: '16px', padding: 0, fontSize: '10px', color: '#ffffff' }}
                            title="Lengthen clip by 1 bar"
                          >
                            +
                          </button>
                          {/* Delete Clip */}
                          <button
                            className="btn-text"
                            onClick={() => onDeleteClip(clip.id)}
                            style={{ width: '16px', height: '16px', padding: 0, color: '#ffffff', marginLeft: '4px' }}
                            title="Remove clip from timeline"
                          >
                            <span className="material-icons-round" style={{ fontSize: '12px' }}>
                              close
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Clip Info & Waveform hint */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255, 255, 255, 0.8)' }}>
                        <span>Starts at Bar {clip.startBar}</span>
                        <span>Ends at Bar {clip.startBar + clip.durationBars}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


import React, { useRef } from 'react';
import { DawTrack, DawClip, EditingTool } from '../../utils/daw/projectModel';

interface DawArrangementViewProps {
  tracks: DawTrack[];
  clips: DawClip[];
  totalBars: number;
  currentStepIndex: number;
  isPlaying: boolean;
  activeTool: EditingTool;
  onChangeTool: (tool: EditingTool) => void;
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onAddClip: (trackId: string, bar: number) => void;
  onMoveClip: (clipId: string, newStartBar: number) => void;
  onResizeClip: (clipId: string, newDurationBars: number) => void;
  onSplitClip: (clipId: string, splitBar: number) => void;
  onDeleteClip: (clipId: string) => void;
  onToggleClipMute: (clipId: string) => void;
  onScrubPlayhead: (bar: number) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackSolo: (trackId: string) => void;
  onToggleTrackArm: (trackId: string) => void;
  onChangeTrackVolume: (trackId: string, volDb: number) => void;
  onChangeTrackPan: (trackId: string, pan: number) => void;
  loopStartBar: number;
  loopEndBar: number;
  isLoopEnabled: boolean;
}

export const DawArrangementView: React.FC<DawArrangementViewProps> = ({
  tracks,
  clips,
  totalBars,
  currentStepIndex,
  isPlaying,
  activeTool,
  onChangeTool,
  selectedTrackId,
  onSelectTrack,
  selectedClipId,
  onSelectClip,
  onAddClip,
  onMoveClip,
  onResizeClip,
  onSplitClip,
  onDeleteClip,
  onToggleClipMute,
  onScrubPlayhead,
  onToggleTrackMute,
  onToggleTrackSolo,
  onToggleTrackArm,
  onChangeTrackVolume,
  onChangeTrackPan,
  loopStartBar,
  loopEndBar,
  isLoopEnabled,
}) => {
  const BAR_WIDTH = 54;
  const HEADER_WIDTH = 230;

  const dragClipRef = useRef<{ clipId: string; startX: number; origStartBar: number } | null>(null);

  const currentPlayheadBar = (currentStepIndex / 16) + 1;

  const handleLaneClick = (trackId: string, bar: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectTrack(trackId);

    const existingClip = clips.find(
      (c) => c.trackId === trackId && bar >= c.startBar && bar < c.startBar + c.durationBars
    );

    if (existingClip) {
      if (activeTool === 'erase') {
        onDeleteClip(existingClip.id);
      } else if (activeTool === 'split') {
        onSplitClip(existingClip.id, bar);
      } else if (activeTool === 'mute') {
        onToggleClipMute(existingClip.id);
      } else {
        onSelectClip(existingClip.id);
      }
    } else if (activeTool === 'draw' || activeTool === 'pointer') {
      onAddClip(trackId, bar);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#101114',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 1. Arranger Tool Bar */}
      <div
        style={{
          height: '34px',
          backgroundColor: '#17191E',
          borderBottom: '1px solid #1D2027',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          gap: '8px',
        }}
      >
        {/* Tool Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {[
            { id: 'pointer' as EditingTool, icon: 'navigation', label: 'Pointer Tool' },
            { id: 'split' as EditingTool, icon: 'content_cut', label: 'Split Tool (S)' },
            { id: 'draw' as EditingTool, icon: 'edit', label: 'Draw Tool (D)' },
            { id: 'erase' as EditingTool, icon: 'delete', label: 'Erase Tool (E)' },
            { id: 'mute' as EditingTool, icon: 'volume_off', label: 'Mute Clip Tool' },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => onChangeTool(tool.id)}
              style={{
                width: '28px',
                height: '26px',
                backgroundColor: activeTool === tool.id ? '#8B78FF' : 'transparent',
                color: activeTool === tool.id ? '#FFFFFF' : '#9CA3AF',
                border: 'none',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title={tool.label}
            >
              <span className="material-icons-round" style={{ fontSize: '16px' }}>{tool.icon}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#697180' }}>
          <span>Tool: <strong style={{ color: '#F3F4F6', textTransform: 'capitalize' }}>{activeTool}</strong></span>
          <span>·</span>
          <span>{tracks.length} Tracks</span>
          <span>·</span>
          <span>{clips.length} Clips</span>
        </div>
      </div>

      {/* 2. Timeline Arranger Grid Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '100%' }}>
          {/* Timeline Bar Ruler */}
          <div
            style={{
              height: '30px',
              backgroundColor: '#17191E',
              borderBottom: '1px solid #1D2027',
              display: 'flex',
              position: 'sticky',
              top: 0,
              zIndex: 20,
            }}
          >
            {/* Header Spacer */}
            <div
              style={{
                width: `${HEADER_WIDTH}px`,
                flexShrink: 0,
                backgroundColor: '#17191E',
                borderRight: '1px solid #1D2027',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#697180',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Tracks
            </div>

            {/* Bar Numbers and Loop Region */}
            <div
              style={{
                display: 'flex',
                position: 'relative',
                flex: 1,
              }}
            >
              {Array.from({ length: totalBars }).map((_, idx) => {
                const barNum = idx + 1;
                const isCurrent = Math.floor(currentPlayheadBar) === barNum;
                const inLoop = isLoopEnabled && barNum >= loopStartBar && barNum < loopEndBar;

                return (
                  <div
                    key={barNum}
                    onClick={() => onScrubPlayhead(barNum)}
                    style={{
                      width: `${BAR_WIDTH}px`,
                      flexShrink: 0,
                      height: '100%',
                      borderRight: '1px solid #1D2027',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: '6px',
                      fontSize: '11px',
                      fontWeight: isCurrent ? 800 : 500,
                      color: isCurrent ? '#35C9A5' : inLoop ? '#8B78FF' : '#9CA3AF',
                      backgroundColor: inLoop ? 'rgba(139, 120, 255, 0.08)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    title={`Jump playhead to Bar ${barNum}`}
                  >
                    {barNum}
                  </div>
                );
              })}

              {/* Red Transport Playhead Cursor */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: '-5000px',
                  left: `${(currentPlayheadBar - 1) * BAR_WIDTH}px`,
                  width: '2px',
                  backgroundColor: '#FF5252',
                  boxShadow: '0 0 8px rgba(255, 82, 82, 0.8)',
                  zIndex: 30,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#FF5252',
                    transform: 'translateX(-3px)',
                    clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Track Rows */}
          {tracks.map((track) => {
            const isTrackSelected = track.id === selectedTrackId;
            const trackClips = clips.filter((c) => c.trackId === track.id);

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                style={{
                  display: 'flex',
                  height: '72px',
                  borderBottom: '1px solid #1D2027',
                  backgroundColor: isTrackSelected ? 'rgba(139, 120, 255, 0.04)' : '#101114',
                }}
              >
                {/* Track Left Header Strip */}
                <div
                  style={{
                    width: `${HEADER_WIDTH}px`,
                    flexShrink: 0,
                    backgroundColor: '#17191E',
                    borderRight: isTrackSelected ? '2px solid #8B78FF' : '1px solid #1D2027',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Top row: Track Color, Name & Type */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: '4px',
                          height: '14px',
                          borderRadius: '2px',
                          backgroundColor: track.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#F3F4F6',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {track.name}
                      </span>
                    </div>

                    <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#697180' }}>
                      {track.type}
                    </span>
                  </div>

                  {/* Middle row: Mute, Solo, Record Arm */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTrackMute(track.id);
                      }}
                      style={{
                        width: '22px',
                        height: '20px',
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: track.isMuted ? '#F5C451' : '#252932',
                        color: track.isMuted ? '#101114' : '#9CA3AF',
                        borderRadius: '3px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title="Mute track"
                    >
                      M
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTrackSolo(track.id);
                      }}
                      style={{
                        width: '22px',
                        height: '20px',
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: track.isSolo ? '#8B78FF' : '#252932',
                        color: track.isSolo ? '#FFFFFF' : '#9CA3AF',
                        borderRadius: '3px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title="Solo track"
                    >
                      S
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTrackArm(track.id);
                      }}
                      style={{
                        width: '22px',
                        height: '20px',
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: track.isArmed ? '#FF5252' : '#252932',
                        color: track.isArmed ? '#FFFFFF' : '#9CA3AF',
                        borderRadius: '3px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title="Arm track for recording"
                    >
                      R
                    </button>
                  </div>

                  {/* Bottom row: Volume & Pan controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: '9px', color: '#697180', width: '22px' }}>VOL</span>
                    <input
                      type="range"
                      min="-48"
                      max="6"
                      step="0.5"
                      value={track.volumeDb}
                      onChange={(e) => onChangeTrackVolume(track.id, parseFloat(e.target.value))}
                      style={{ flex: 1, height: '4px', cursor: 'pointer' }}
                      title={`Volume: ${track.volumeDb.toFixed(1)} dB`}
                    />
                    <span style={{ fontSize: '9px', color: '#9CA3AF', width: '32px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {track.volumeDb > 0 ? `+${track.volumeDb.toFixed(1)}` : track.volumeDb.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Track Lane Grid & Clips */}
                <div
                  style={{
                    display: 'flex',
                    flex: 1,
                    position: 'relative',
                    cursor: activeTool === 'draw' ? 'crosshair' : 'default',
                  }}
                >
                  {/* Background Bar Lines */}
                  {Array.from({ length: totalBars }).map((_, idx) => {
                    const barNum = idx + 1;
                    return (
                      <div
                        key={barNum}
                        onClick={(e) => handleLaneClick(track.id, barNum, e)}
                        style={{
                          width: `${BAR_WIDTH}px`,
                          flexShrink: 0,
                          height: '100%',
                          borderRight: '1px solid #1D2027',
                          backgroundColor: track.isMuted ? 'rgba(0, 0, 0, 0.25)' : 'transparent',
                        }}
                      />
                    );
                  })}

                  {/* Rendered Clips */}
                  {trackClips.map((clip) => {
                    const isClipSelected = clip.id === selectedClipId;
                    const leftPx = (clip.startBar - 1) * BAR_WIDTH;
                    const widthPx = clip.durationBars * BAR_WIDTH - 2;

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'erase') {
                            onDeleteClip(clip.id);
                          } else if (activeTool === 'split') {
                            onSplitClip(clip.id, Math.floor(currentPlayheadBar));
                          } else if (activeTool === 'mute') {
                            onToggleClipMute(clip.id);
                          } else {
                            onSelectClip(clip.id);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: `${leftPx}px`,
                          width: `${widthPx}px`,
                          top: '4px',
                          bottom: '4px',
                          backgroundColor: clip.color || track.color,
                          borderRadius: '4px',
                          border: isClipSelected ? '2px solid #FFFFFF' : '1px solid rgba(0, 0, 0, 0.4)',
                          boxShadow: isClipSelected ? '0 0 10px rgba(139, 120, 255, 0.6)' : 'none',
                          opacity: clip.isMuted ? 0.45 : 1.0,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '4px 6px',
                          cursor: 'grab',
                          overflow: 'hidden',
                          zIndex: isClipSelected ? 5 : 1,
                        }}
                        title={`${clip.name} (Starts at Bar ${clip.startBar}, Duration ${clip.durationBars} bars)`}
                      >
                        {/* Clip Header Label */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                            }}
                          >
                            {clip.name}
                          </span>

                          <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'monospace' }}>
                            {clip.durationBars}b
                          </span>
                        </div>

                        {/* High-Resolution Waveform Preview for Audio Clips */}
                        {clip.type === 'audio' && clip.peaks && clip.peaks.length > 0 && (
                          <div style={{ height: '30px', width: '100%', overflow: 'hidden', opacity: 0.9 }}>
                            <svg width="100%" height="100%" viewBox={`0 0 ${clip.peaks.length} 30`} preserveAspectRatio="none">
                              {clip.peaks.map((peak, pIdx) => {
                                const h = Math.max(2, peak * 28);
                                const y = 15 - h / 2;
                                return (
                                  <rect
                                    key={pIdx}
                                    x={pIdx}
                                    y={y}
                                    width={0.8}
                                    height={h}
                                    fill="#FFFFFF"
                                  />
                                );
                              })}
                            </svg>
                          </div>
                        )}

                        {/* MIDI Note Preview for MIDI Clips */}
                        {clip.type === 'midi' && clip.notes && clip.notes.length > 0 && (
                          <div style={{ height: '28px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                            {clip.notes.map((note) => {
                              const noteLeft = (note.step / 16) * (widthPx / Math.max(1, clip.durationBars));
                              const noteWidth = Math.max(4, (note.durationSteps / 16) * (widthPx / Math.max(1, clip.durationBars)));
                              return (
                                <div
                                  key={note.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${noteLeft}px`,
                                    width: `${noteWidth}px`,
                                    top: '4px',
                                    height: '6px',
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '1px',
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Resize handle right edge */}
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '8px',
                            cursor: 'ew-resize',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newDur = prompt('Enter new duration in bars:', String(clip.durationBars));
                            if (newDur) {
                              const parsed = parseInt(newDur, 10);
                              if (!isNaN(parsed) && parsed >= 1) onResizeClip(clip.id, parsed);
                            }
                          }}
                          title="Click to change duration"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

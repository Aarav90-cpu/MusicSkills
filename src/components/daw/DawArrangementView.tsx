import React, { useState, useEffect } from 'react';
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
  onMoveClip: (clipId: string, newStartBar: number, newTrackId?: string) => void;
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
  onDoubleClickClip?: (clipId: string) => void;
  loopStartBar: number;
  loopEndBar: number;
  isLoopEnabled: boolean;
  onAddTrack?: (type: DawTrack['type'], name: string, color: string, preset?: string) => void;
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
  onDoubleClickClip,
  loopStartBar,
  loopEndBar,
  isLoopEnabled,
  onAddTrack,
}) => {
  const BAR_WIDTH = 54;
  const HEADER_WIDTH = 230;

  const [activeDrag, setActiveDrag] = useState<{
    clipId: string;
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    initialStartBar: number;
    initialDurationBars: number;
    initialTrackIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - activeDrag.startX;
      const deltaBars = Math.round(dx / BAR_WIDTH);

      if (activeDrag.type === 'move') {
        const newStart = Math.max(
          1,
          Math.min(totalBars - activeDrag.initialDurationBars + 1, activeDrag.initialStartBar + deltaBars)
        );
        const dy = e.clientY - activeDrag.startY;
        const deltaTracks = Math.round(dy / 72);
        const targetTrackIndex = Math.max(0, Math.min(tracks.length - 1, activeDrag.initialTrackIndex + deltaTracks));
        const targetTrack = tracks[targetTrackIndex];

        const clip = clips.find((c) => c.id === activeDrag.clipId);
        const isCompatible = clip && targetTrack && (
          (clip.type === 'audio' && targetTrack.type === 'audio') ||
          (clip.type === 'midi' && targetTrack.type !== 'audio')
        );

        const newTrackId = isCompatible ? targetTrack.id : tracks[activeDrag.initialTrackIndex]?.id;
        onMoveClip(activeDrag.clipId, newStart, newTrackId);
      } else if (activeDrag.type === 'resize') {
        const newDur = Math.max(
          1,
          Math.min(totalBars - activeDrag.initialStartBar + 1, activeDrag.initialDurationBars + deltaBars)
        );
        onResizeClip(activeDrag.clipId, newDur);
      }
    };

    const handlePointerUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, totalBars, BAR_WIDTH, onMoveClip, onResizeClip]);

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
    } else if (activeTool === 'draw') {
      onAddClip(trackId, bar);
    } else if (activeTool === 'pointer') {
      onScrubPlayhead(bar);
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
          <span>/</span>
          <span>{tracks.length} Tracks</span>
          <span>/</span>
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

                    <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: track.type === 'audio' ? '#697180' : '#8B78FF', backgroundColor: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: '2px' }}>
                      {track.type === 'audio' ? 'AUDIO' : (track.instrumentPreset || track.type)}
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
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onAddClip(track.id, barNum);
                        }}
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
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip.id);
                          onSelectTrack(track.id);

                          if (activeTool === 'erase') {
                            onDeleteClip(clip.id);
                            return;
                          }
                          if (activeTool === 'split') {
                            onSplitClip(clip.id, Math.floor(currentPlayheadBar));
                            return;
                          }
                          if (activeTool === 'mute') {
                            onToggleClipMute(clip.id);
                            return;
                          }

                          // Start dragging clip across bars and tracks
                          const trackIndex = tracks.findIndex((t) => t.id === track.id);
                          setActiveDrag({
                            clipId: clip.id,
                            type: 'move',
                            startX: e.clientX,
                            startY: e.clientY,
                            initialStartBar: clip.startBar,
                            initialDurationBars: clip.durationBars,
                            initialTrackIndex: trackIndex,
                          });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onDoubleClickClip?.(clip.id);
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
                          cursor: activeTool === 'erase' ? 'pointer' : activeTool === 'split' ? 'crosshair' : 'grab',
                          overflow: 'hidden',
                          zIndex: isClipSelected ? 5 : 1,
                        }}
                        title={`${clip.name} (Starts at Bar ${clip.startBar}, Duration ${clip.durationBars} bars) - Drag to move, drag right edge to resize, double-click to edit`}
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

                        {/* Interactive Drag-to-Resize Right Edge Handle */}
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '10px',
                            cursor: 'ew-resize',
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            borderTopRightRadius: '4px',
                            borderBottomRightRadius: '4px',
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onSelectClip(clip.id);
                            const trackIndex = tracks.findIndex((t) => t.id === track.id);
                            setActiveDrag({
                              clipId: clip.id,
                              type: 'resize',
                              startX: e.clientX,
                              startY: e.clientY,
                              initialStartBar: clip.startBar,
                              initialDurationBars: clip.durationBars,
                              initialTrackIndex: trackIndex,
                            });
                          }}
                          title="Drag right edge to change duration in bars"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Add Track Control Bar at bottom of arrangement */}
          {onAddTrack && (
            <div
              style={{
                display: 'flex',
                height: '38px',
                borderBottom: '1px solid #1D2027',
                backgroundColor: '#121418',
              }}
            >
              <div
                style={{
                  width: `${HEADER_WIDTH}px`,
                  flexShrink: 0,
                  backgroundColor: '#14161C',
                  borderRight: '1px solid #1D2027',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#697180', marginRight: '2px' }}>
                  + TRACK:
                </span>
                <button
                  onClick={() => onAddTrack('audio', `Audio ${tracks.length + 1}`, '#35C9A5')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: '#1D2027',
                    color: '#35C9A5',
                    border: '1px solid #252932',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Add new Audio Track"
                >
                  Audio
                </button>
                <button
                  onClick={() => onAddTrack('midi', `Keys ${tracks.length + 1}`, '#8B78FF', 'piano')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: '#1D2027',
                    color: '#8B78FF',
                    border: '1px solid #252932',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Add new MIDI Keys Track"
                >
                  MIDI
                </button>
                <button
                  onClick={() => onAddTrack('instrument', `Bass ${tracks.length + 1}`, '#FF5252', 'bass')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: '#1D2027',
                    color: '#FF5252',
                    border: '1px solid #252932',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Add new 808 Bass Track"
                >
                  Bass
                </button>
                <button
                  onClick={() => onAddTrack('instrument', `Drums ${tracks.length + 1}`, '#E9A45B', 'drums')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: '#1D2027',
                    color: '#E9A45B',
                    border: '1px solid #252932',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Add new Drum Sequencer Track"
                >
                  Drums
                </button>
              </div>
              <div
                style={{
                  width: `${totalBars * BAR_WIDTH}px`,
                  flexShrink: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


/**
 * MusicSkills - Professional Melodic Piano Roll Editor
 * Desktop DAW piano roll with chromatic pitch grid across 5 octaves,
 * chord stamping, multi-bar pattern navigation, auditioning, and synth preset routing.
 * Strictly zero-emoji.
 */

import React, { useState, useEffect } from 'react';
import { StudioNote } from '../../types';
import { dawSynthEngine, SYNTH_PRESETS } from '../../utils/daw/synthEngine';

interface PianoRollProps {
  notes: StudioNote[];
  onAddNote: (note: StudioNote) => void;
  onRemoveNote: (noteId: string) => void;
  onClearNotes: () => void;
  instrument: string;
  onChangeInstrument: (inst: string) => void;
  songKey: string;
  songScale: string;
  currentStepIndex: number;
  isPlaying: boolean;
  clipName?: string;
  totalClipBars?: number;
  availableClips?: Array<{ id: string; name: string; trackName?: string }>;
  selectedClipId?: string;
  onSelectClipId?: (id: string) => void;
}

// Generate 5 Octaves of Chromatic Pitches from C6 down to C1 (72 chromatic notes)
const NOTE_NAMES = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
const GENERATED_PITCHES: string[] = [];
for (let oct = 6; oct >= 1; oct--) {
  NOTE_NAMES.forEach((name) => {
    GENERATED_PITCHES.push(`${name}${oct}`);
  });
}

const CHORD_PRESETS = [
  { label: 'Major Chord', intervals: [0, 4, 7] },
  { label: 'Minor Chord', intervals: [0, 3, 7] },
  { label: 'Major 7th', intervals: [0, 4, 7, 11] },
  { label: 'Minor 7th', intervals: [0, 3, 7, 10] },
  { label: 'Sus4 Chord', intervals: [0, 5, 7] },
  { label: '5th Power Chord', intervals: [0, 7] },
];

export const PianoRoll: React.FC<PianoRollProps> = ({
  notes,
  onAddNote,
  onRemoveNote,
  onClearNotes,
  instrument,
  onChangeInstrument,
  songKey,
  songScale,
  currentStepIndex,
  isPlaying,
  clipName = 'MIDI Clip',
  totalClipBars = 4,
  availableClips = [],
  selectedClipId,
  onSelectClipId,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(2); // 2 steps (8th note)
  const [stampChordType, setStampChordType] = useState<string>('none');
  const [octaveRange, setOctaveRange] = useState<'bass' | 'mid' | 'high' | 'all'>(
    instrument === 'bass' ? 'bass' : 'mid'
  );
  const [currentBarPage, setCurrentBarPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'paged' | 'full'>('paged');

  // Sync default octave range if instrument changes to bass
  useEffect(() => {
    if (instrument === 'bass') {
      setOctaveRange('bass');
    }
  }, [instrument]);

  // Filter pitches based on octave range
  const visiblePitches = GENERATED_PITCHES.filter((p) => {
    const oct = parseInt(p.slice(-1), 10);
    if (octaveRange === 'bass') return oct >= 1 && oct <= 3;
    if (octaveRange === 'mid') return oct >= 3 && oct <= 5;
    if (octaveRange === 'high') return oct >= 4 && oct <= 6;
    return true; // 'all'
  });

  const playPitchSound = (pitch: string, durSteps = 2) => {
    const durSec = durSteps * 0.125;
    dawSynthEngine.playNote(pitch, durSec, 0.8, instrument);
  };

  const handleCellClick = (pitch: string, absoluteStep: number) => {
    // Check if a note already exists at this pitch and step
    const existing = notes.find((n) => n.pitch === pitch && n.step === absoluteStep);
    if (existing) {
      onRemoveNote(existing.id);
      return;
    }

    if (stampChordType !== 'none') {
      const preset = CHORD_PRESETS.find((p) => p.label === stampChordType);
      if (preset) {
        const rootIndex = visiblePitches.indexOf(pitch);
        if (rootIndex !== -1) {
          preset.intervals.forEach((interval, idx) => {
            const targetRow = rootIndex - interval;
            if (targetRow >= 0 && targetRow < visiblePitches.length) {
              const chordPitch = visiblePitches[targetRow];
              onAddNote({
                id: `note_${chordPitch}_${absoluteStep}_${Date.now()}_${idx}`,
                pitch: chordPitch,
                step: absoluteStep,
                durationSteps: selectedDuration,
                velocity: 0.8,
              });
            }
          });
          playPitchSound(pitch, selectedDuration);
          return;
        }
      }
    }

    // Single note placement
    playPitchSound(pitch, selectedDuration);
    onAddNote({
      id: `note_${pitch}_${absoluteStep}_${Date.now()}`,
      pitch,
      step: absoluteStep,
      durationSteps: selectedDuration,
      velocity: 0.8,
    });
  };

  // Determine step columns to display
  const barsCount = Math.max(1, totalClipBars);
  const totalSteps = barsCount * 16;
  const startStep = viewMode === 'paged' ? (currentBarPage - 1) * 16 : 0;
  const displayStepCount = viewMode === 'paged' ? 16 : totalSteps;

  return (
    <div
      style={{
        backgroundColor: '#17191E',
        border: '1px solid #252932',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        userSelect: 'none',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #22252C',
          paddingBottom: '12px',
        }}
      >
        {/* Left: Title & Clip Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ color: '#8B78FF', fontSize: '20px' }}>
            piano
          </span>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#F3F4F6' }}>
            Piano Roll Note Editor
          </span>

          {availableClips.length > 1 && onSelectClipId ? (
            <select
              value={selectedClipId}
              onChange={(e) => onSelectClipId(e.target.value)}
              style={{
                height: '24px',
                fontSize: '11px',
                backgroundColor: '#111216',
                border: '1px solid #3F4452',
                color: '#8B78FF',
                fontWeight: 600,
                borderRadius: '4px',
                padding: '0 6px',
              }}
            >
              {availableClips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.trackName ? `(${c.trackName})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                backgroundColor: '#252932',
                borderRadius: '4px',
                color: '#8B78FF',
                fontWeight: 600,
              }}
            >
              {clipName} ({barsCount} bars)
            </span>
          )}

          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: '#1F232C',
              borderRadius: '4px',
              color: '#9CA3AF',
              fontWeight: 600,
            }}
          >
            Key {songKey} {songScale}
          </span>
        </div>

        {/* Right: Controls & Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sound Preset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Sound:</span>
            <select
              value={instrument}
              onChange={(e) => onChangeInstrument(e.target.value)}
              style={{
                height: '26px',
                fontSize: '11px',
                backgroundColor: '#111216',
                border: '1px solid #2D3139',
                borderRadius: '4px',
                color: '#F3F4F6',
                padding: '0 6px',
              }}
            >
              {Object.values(SYNTH_PRESETS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Octave Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Octave:</span>
            <select
              value={octaveRange}
              onChange={(e) => setOctaveRange(e.target.value as any)}
              style={{
                height: '26px',
                fontSize: '11px',
                backgroundColor: '#111216',
                border: '1px solid #2D3139',
                borderRadius: '4px',
                color: '#F3F4F6',
                padding: '0 6px',
              }}
            >
              <option value="bass">Bass (C1 - C3)</option>
              <option value="mid">Mid / Chords (C3 - C5)</option>
              <option value="high">High / Lead (C4 - C6)</option>
              <option value="all">Full Range (C1 - C6)</option>
            </select>
          </div>

          {/* Note Duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Length:</span>
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(parseInt(e.target.value, 10))}
              style={{
                height: '26px',
                fontSize: '11px',
                backgroundColor: '#111216',
                border: '1px solid #2D3139',
                borderRadius: '4px',
                color: '#F3F4F6',
                padding: '0 6px',
              }}
            >
              <option value={1}>1/16 Note</option>
              <option value={2}>1/8 Note</option>
              <option value={4}>1/4 Note (Beat)</option>
              <option value={8}>1/2 Note</option>
              <option value={16}>1 Bar</option>
            </select>
          </div>

          {/* Chord Stamper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Chord:</span>
            <select
              value={stampChordType}
              onChange={(e) => setStampChordType(e.target.value)}
              style={{
                height: '26px',
                fontSize: '11px',
                backgroundColor: '#111216',
                border: '1px solid #2D3139',
                borderRadius: '4px',
                color: '#F3F4F6',
                padding: '0 6px',
              }}
            >
              <option value="none">Single Note</option>
              {CHORD_PRESETS.map((chord) => (
                <option key={chord.label} value={chord.label}>
                  {chord.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Notes */}
          <button
            onClick={onClearNotes}
            style={{
              height: '26px',
              padding: '0 8px',
              backgroundColor: '#252932',
              border: '1px solid #3F4452',
              borderRadius: '4px',
              color: '#F3F4F6',
              fontSize: '11px',
              cursor: 'pointer',
            }}
            title="Clear all notes in pattern"
          >
            Clear
          </button>
        </div>
      </div>

      {/* 2. Bar Page Navigation (When clip is multi-bar) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#14161B',
          padding: '6px 10px',
          borderRadius: '4px',
          border: '1px solid #252932',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>Viewing Bar:</span>
          {Array.from({ length: barsCount }).map((_, idx) => {
            const barNum = idx + 1;
            const isSelected = viewMode === 'paged' && currentBarPage === barNum;
            const currentPlayheadBar = Math.floor(currentStepIndex / 16) + 1;
            const isPlayingThisBar = isPlaying && currentPlayheadBar === barNum;

            return (
              <button
                key={barNum}
                onClick={() => {
                  setViewMode('paged');
                  setCurrentBarPage(barNum);
                }}
                style={{
                  height: '22px',
                  padding: '0 8px',
                  backgroundColor: isSelected ? '#8B78FF' : '#1F232C',
                  border: isPlayingThisBar ? '1px solid #35C9A5' : '1px solid #2D3139',
                  borderRadius: '3px',
                  color: isSelected ? '#FFFFFF' : '#9CA3AF',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Bar {barNum} {isPlayingThisBar ? '(Live)' : ''}
              </button>
            );
          })}

          <button
            onClick={() => setViewMode(viewMode === 'full' ? 'paged' : 'full')}
            style={{
              height: '22px',
              padding: '0 8px',
              backgroundColor: viewMode === 'full' ? '#35C9A5' : '#1F232C',
              border: '1px solid #2D3139',
              borderRadius: '3px',
              color: viewMode === 'full' ? '#101114' : '#9CA3AF',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: '4px',
            }}
          >
            {viewMode === 'full' ? 'Showing All Bars' : 'Show All Bars'}
          </button>
        </div>

        <div style={{ fontSize: '10px', color: '#697180' }}>
          {notes.length} total note{notes.length === 1 ? '' : 's'} in clip
        </div>
      </div>

      {/* 3. Piano Roll Grid Area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '440px',
          overflowY: 'auto',
          overflowX: 'auto',
          border: '1px solid #252932',
          borderRadius: '6px',
          backgroundColor: '#101114',
        }}
      >
        {visiblePitches.map((pitch) => {
          const isAccidental = pitch.includes('#');
          const isRootKey = pitch.startsWith(songKey);

          return (
            <div
              key={pitch}
              style={{
                display: 'flex',
                height: '22px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              {/* Keyboard Key Column */}
              <button
                onClick={() => playPitchSound(pitch, 2)}
                style={{
                  width: '60px',
                  flexShrink: 0,
                  height: '100%',
                  backgroundColor: isAccidental ? '#17191E' : '#22252C',
                  color: isRootKey ? '#8B78FF' : isAccidental ? '#9CA3AF' : '#F3F4F6',
                  border: 'none',
                  borderRight: isRootKey ? '2px solid #8B78FF' : '1px solid #2D3139',
                  textAlign: 'right',
                  paddingRight: '6px',
                  fontSize: '10px',
                  fontWeight: isRootKey ? 800 : 500,
                  cursor: 'pointer',
                  userSelect: 'none',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                }}
                title={`Click to audition ${pitch}`}
              >
                {pitch}
              </button>

              {/* Step Grid Cells */}
              <div style={{ display: 'flex', flex: 1, minWidth: viewMode === 'full' ? `${totalSteps * 28}px` : 'auto' }}>
                {Array.from({ length: displayStepCount }).map((_, colIdx) => {
                  const absoluteStep = startStep + colIdx;
                  const isCurrent = isPlaying && currentStepIndex === absoluteStep;
                  const isBeatStart = absoluteStep % 4 === 0;
                  const isBarStart = absoluteStep % 16 === 0;

                  // Find note covering this step
                  const note = notes.find(
                    (n) => n.pitch === pitch && absoluteStep >= n.step && absoluteStep < n.step + n.durationSteps
                  );
                  const isNoteStart = note && note.step === absoluteStep;

                  return (
                    <div
                      key={colIdx}
                      onClick={() => handleCellClick(pitch, absoluteStep)}
                      style={{
                        flex: viewMode === 'paged' ? 1 : 'none',
                        width: viewMode === 'full' ? '28px' : 'auto',
                        height: '100%',
                        borderRight: isBarStart
                          ? '1px solid rgba(255, 255, 255, 0.2)'
                          : isBeatStart
                          ? '1px solid rgba(255, 255, 255, 0.08)'
                          : '1px solid rgba(255, 255, 255, 0.02)',
                        backgroundColor: note
                          ? '#8B78FF'
                          : isCurrent
                          ? 'rgba(139, 120, 255, 0.25)'
                          : isAccidental
                          ? 'rgba(0, 0, 0, 0.3)'
                          : 'transparent',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: note && isNoteStart ? '0 0 6px rgba(139, 120, 255, 0.8)' : 'none',
                      }}
                      title={`${pitch} (Bar ${Math.floor(absoluteStep / 16) + 1}, Beat ${Math.floor((absoluteStep % 16) / 4) + 1}, Step ${(absoluteStep % 4) + 1})`}
                    >
                      {note && isNoteStart && (
                        <div
                          style={{
                            position: 'absolute',
                            left: '2px',
                            top: '2px',
                            bottom: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '2px',
                          }}
                        />
                      )}
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

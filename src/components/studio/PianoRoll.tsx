import React, { useState } from 'react';
import { StudioNote } from '../../types';
import { dawAudioEngine, pitchToFrequency } from '../../utils/dawAudioEngine';

interface PianoRollProps {
  notes: StudioNote[];
  onAddNote: (note: StudioNote) => void;
  onRemoveNote: (noteId: string) => void;
  onClearNotes: () => void;
  instrument: 'piano' | 'bass' | 'synth' | 'pluck';
  onChangeInstrument: (inst: 'piano' | 'bass' | 'synth' | 'pluck') => void;
  songKey: string;
  songScale: string;
  currentStepIndex: number;
  isPlaying: boolean;
}

// 2 Octaves of Chromatic Pitches from C5 down to C3
const PITCHES = [
  'C5', 'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4',
  'C4', 'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3',
];

const CHORD_PRESETS = [
  { label: 'Major Chord', intervals: [0, 4, 7] },
  { label: 'Minor Chord', intervals: [0, 3, 7] },
  { label: 'Major 7th', intervals: [0, 4, 7, 11] },
  { label: 'Minor 7th', intervals: [0, 3, 7, 10] },
  { label: 'Sus4 Chord', intervals: [0, 5, 7] },
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
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(2); // Default 2 steps (8th note)
  const [stampChordType, setStampChordType] = useState<string>('none');

  const playPitchSound = (pitch: string, durSteps = 2) => {
    const freq = pitchToFrequency(pitch);
    const durSec = (durSteps * 0.125);
    switch (instrument) {
      case 'piano':
        dawAudioEngine.playPianoNote(undefined, freq, durSec);
        break;
      case 'bass':
        dawAudioEngine.playBassNote(undefined, freq, durSec);
        break;
      case 'synth':
        dawAudioEngine.playSynthNote(undefined, freq, durSec);
        break;
      case 'pluck':
        dawAudioEngine.playPluckNote(undefined, freq, durSec);
        break;
    }
  };

  const handleCellClick = (pitch: string, step: number) => {
    // Check if a note already exists at this pitch and step
    const existing = notes.find(n => n.pitch === pitch && n.step === step);
    if (existing) {
      onRemoveNote(existing.id);
      return;
    }

    if (stampChordType !== 'none') {
      const preset = CHORD_PRESETS.find(p => p.label === stampChordType);
      if (preset) {
        const rootIndex = PITCHES.indexOf(pitch);
        if (rootIndex !== -1) {
          preset.intervals.forEach((interval, idx) => {
            // Lower row index corresponds to higher pitch in our inverted array
            const targetRow = rootIndex - interval;
            if (targetRow >= 0 && targetRow < PITCHES.length) {
              const chordPitch = PITCHES[targetRow];
              onAddNote({
                id: `note_${chordPitch}_${step}_${Date.now()}_${idx}`,
                pitch: chordPitch,
                step,
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

    // Place single note
    playPitchSound(pitch, selectedDuration);
    onAddNote({
      id: `note_${pitch}_${step}_${Date.now()}`,
      pitch,
      step,
      durationSteps: selectedDuration,
      velocity: 0.8,
    });
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
        gap: '14px',
        overflowX: 'auto',
      }}
    >
      {/* Piano Roll Header & Tools */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
            piano
          </span>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
            Piano Roll (LMMS Melodic Note Editor)
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
            Key {songKey} {songScale}
          </span>
        </div>

        {/* Instrument & Tool Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Instrument Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Sound:</span>
            <select
              className="input-field"
              value={instrument}
              onChange={e => onChangeInstrument(e.target.value as any)}
              style={{ height: '32px', fontSize: '12px', padding: '0 8px', cursor: 'pointer' }}
            >
              <option value="piano">Grand Piano</option>
              <option value="bass">Deep Bass</option>
              <option value="synth">Synth Lead</option>
              <option value="pluck">Melodic Pluck</option>
            </select>
          </div>

          {/* Note Length Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Note Length:</span>
            <select
              className="input-field"
              value={selectedDuration}
              onChange={e => setSelectedDuration(parseInt(e.target.value, 10))}
              style={{ height: '32px', fontSize: '12px', padding: '0 8px', cursor: 'pointer' }}
            >
              <option value={1}>1/16 Note (1 step)</option>
              <option value={2}>1/8 Note (2 steps)</option>
              <option value={4}>1/4 Note (1 beat)</option>
              <option value={8}>1/2 Note (2 beats)</option>
            </select>
          </div>

          {/* Chord Stamper Tool */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Chord Stamp:</span>
            <select
              className="input-field"
              value={stampChordType}
              onChange={e => setStampChordType(e.target.value)}
              style={{ height: '32px', fontSize: '12px', padding: '0 8px', cursor: 'pointer' }}
            >
              <option value="none">Single Note</option>
              {CHORD_PRESETS.map(chord => (
                <option key={chord.label} value={chord.label}>
                  {chord.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Notes */}
          <button
            className="btn btn-outlined"
            onClick={onClearNotes}
            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
            title="Clear all notes in pattern"
          >
            Clear Pattern
          </button>
        </div>
      </div>

      {/* Piano Roll Grid View */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '360px',
          overflowY: 'auto',
          border: '1px solid var(--color-outline)',
          borderRadius: '8px',
        }}
      >
        {PITCHES.map(pitch => {
          const isAccidental = pitch.includes('#') || pitch.includes('b');
          const isRootKey = pitch.startsWith(songKey);

          return (
            <div
              key={pitch}
              style={{
                display: 'flex',
                height: '24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              {/* Keyboard Key Column */}
              <button
                onClick={() => playPitchSound(pitch, 2)}
                style={{
                  width: '64px',
                  flexShrink: 0,
                  height: '100%',
                  backgroundColor: isAccidental ? '#1e1c26' : '#2b2938',
                  color: isRootKey ? 'var(--color-primary)' : isAccidental ? '#9e9e9e' : '#e0e0e0',
                  border: 'none',
                  borderRight: isRootKey ? '2px solid var(--color-primary)' : '1px solid var(--color-outline)',
                  textAlign: 'right',
                  paddingRight: '6px',
                  fontSize: '10px',
                  fontWeight: isRootKey ? 700 : 500,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title={`Click to play ${pitch}`}
              >
                {pitch}
              </button>

              {/* 16 Step Grid Cells */}
              <div style={{ display: 'flex', flex: 1 }}>
                {Array.from({ length: 16 }).map((_, stepIdx) => {
                  const isCurrent = isPlaying && currentStepIndex % 16 === stepIdx;
                  const isBeatStart = stepIdx % 4 === 0;

                  // Find note starting at or covering this cell
                  const note = notes.find(
                    n => n.pitch === pitch && stepIdx >= n.step && stepIdx < n.step + n.durationSteps
                  );
                  const isNoteStart = note && note.step === stepIdx;

                  return (
                    <div
                      key={stepIdx}
                      onClick={() => handleCellClick(pitch, stepIdx)}
                      style={{
                        flex: 1,
                        height: '100%',
                        borderRight: isBeatStart ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.03)',
                        backgroundColor: note
                          ? 'var(--color-primary)'
                          : isCurrent
                          ? 'rgba(124, 77, 255, 0.15)'
                          : isAccidental
                          ? 'rgba(0, 0, 0, 0.25)'
                          : 'transparent',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: note && isNoteStart ? '0 0 6px rgba(124, 77, 255, 0.6)' : 'none',
                      }}
                      title={`${pitch} at step ${stepIdx + 1}`}
                    >
                      {note && isNoteStart && (
                        <div
                          style={{
                            position: 'absolute',
                            left: '2px',
                            top: '2px',
                            bottom: '2px',
                            right: '2px',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
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

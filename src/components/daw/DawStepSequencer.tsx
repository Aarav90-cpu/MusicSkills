/**
 * MusicSkills - DAW Step Sequencer (Beat Matrix & Drum Machine)
 * Hardware-style 16-step rhythmic grid inspired by LMMS and professional drum machines.
 * Supports preset patterns, sample auditioning, channel mute/solo, and timeline commitment.
 * Strictly zero-emoji.
 */

import React, { useState, useEffect, useRef } from 'react';
import { dawAudioEngine } from '../../utils/dawAudioEngine';
import { BEAT_PRESETS, BeatPreset } from '../../utils/beatPresets';

export interface StepSequencerVoiceState {
  id: string;
  name: string;
  color: string;
  steps: boolean[];
  isMuted: boolean;
  isSolo: boolean;
}

interface DawStepSequencerProps {
  currentStepIndex: number;
  isPlaying: boolean;
  bpm: number;
  onCommitToTimeline: (drumPattern: Record<string, boolean[]>, startBar: number, name: string) => void;
  currentPlayheadBar: number;
}

const DEFAULT_VOICES: StepSequencerVoiceState[] = [
  {
    id: 'kick',
    name: 'Kick Drum (808 Punch)',
    color: '#FF5252',
    steps: [true, false, false, false, false, false, false, false, true, false, true, false, false, false, false, false],
    isMuted: false,
    isSolo: false,
  },
  {
    id: 'snare',
    name: 'Snare Snap',
    color: '#FF9800',
    steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    isMuted: false,
    isSolo: false,
  },
  {
    id: 'hihatClosed',
    name: 'Closed Hi-Hat',
    color: '#F5C451',
    steps: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    isMuted: false,
    isSolo: false,
  },
  {
    id: 'hihatOpen',
    name: 'Open Hi-Hat',
    color: '#35C9A5',
    steps: [false, false, false, false, false, false, true, false, false, false, false, false, false, false, true, false],
    isMuted: false,
    isSolo: false,
  },
  {
    id: 'clap',
    name: 'Hand Clap',
    color: '#38BDF8',
    steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    isMuted: false,
    isSolo: false,
  },
  {
    id: 'sub808',
    name: '808 Sub Bass',
    color: '#8B78FF',
    steps: [true, false, false, true, false, false, false, false, true, false, false, false, false, true, false, false],
    isMuted: false,
    isSolo: false,
  },
  {
    id: 'perc',
    name: 'Perc / Rimshot',
    color: '#EC4899',
    steps: [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false],
    isMuted: false,
    isSolo: false,
  },
];

export const DawStepSequencer: React.FC<DawStepSequencerProps> = ({
  currentStepIndex,
  isPlaying,
  bpm,
  onCommitToTimeline,
  currentPlayheadBar,
}) => {
  const [voices, setVoices] = useState<StepSequencerVoiceState[]>(DEFAULT_VOICES);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('trap-808-drift');
  const [commitBar, setCommitBar] = useState<number>(currentPlayheadBar);

  const activeStep = currentStepIndex % 16;
  const lastPlayedStepRef = useRef<number>(-1);

  // Live rhythm playback synchronized with master transport
  useEffect(() => {
    if (!isPlaying) {
      lastPlayedStepRef.current = -1;
      return;
    }

    const stepIn16 = currentStepIndex % 16;
    if (stepIn16 === lastPlayedStepRef.current) return;
    lastPlayedStepRef.current = stepIn16;

    const anySoloed = voices.some((v) => v.isSolo);

    voices.forEach((voice) => {
      if (anySoloed && !voice.isSolo) return;
      if (voice.isMuted) return;

      if (voice.steps[stepIn16]) {
        handleAudition(voice.id);
      }
    });
  }, [isPlaying, currentStepIndex, voices]);

  // Audition voice sound immediately
  const handleAudition = (voiceId: string) => {
    switch (voiceId) {
      case 'kick':
        dawAudioEngine.playKick();
        break;
      case 'snare':
        dawAudioEngine.playSnare();
        break;
      case 'hihatClosed':
        dawAudioEngine.playHiHatClosed();
        break;
      case 'hihatOpen':
        dawAudioEngine.playHiHatOpen();
        break;
      case 'clap':
        dawAudioEngine.playClap();
        break;
      case 'sub808':
        dawAudioEngine.play808Sub();
        break;
      case 'perc':
        dawAudioEngine.playPerc();
        break;
      default:
        dawAudioEngine.playKick();
    }
  };

  const handleToggleStep = (voiceId: string, stepIdx: number) => {
    setVoices((prev) =>
      prev.map((v) => {
        if (v.id === voiceId) {
          const nextSteps = [...v.steps];
          nextSteps[stepIdx] = !nextSteps[stepIdx];
          if (nextSteps[stepIdx]) {
            handleAudition(voiceId);
          }
          return { ...v, steps: nextSteps };
        }
        return v;
      })
    );
  };

  const handleFillInterval = (voiceId: string, interval: number) => {
    setVoices((prev) =>
      prev.map((v) => {
        if (v.id === voiceId) {
          const nextSteps = v.steps.map((_, i) => i % interval === 0);
          return { ...v, steps: nextSteps };
        }
        return v;
      })
    );
  };

  const handleClearVoice = (voiceId: string) => {
    setVoices((prev) =>
      prev.map((v) => (v.id === voiceId ? { ...v, steps: Array(16).fill(false) } : v))
    );
  };

  const handleShiftVoice = (voiceId: string, direction: -1 | 1) => {
    setVoices((prev) =>
      prev.map((v) => {
        if (v.id === voiceId) {
          const len = v.steps.length;
          const nextSteps = Array(len);
          for (let i = 0; i < len; i++) {
            const targetIdx = (i + direction + len) % len;
            nextSteps[targetIdx] = v.steps[i];
          }
          return { ...v, steps: nextSteps };
        }
        return v;
      })
    );
  };

  const handleLoadPreset = (preset: BeatPreset) => {
    setSelectedPresetId(preset.id);
    setVoices((prev) =>
      prev.map((v) => {
        const presetSteps = (preset.drumSteps as any)[v.id];
        if (presetSteps && Array.isArray(presetSteps)) {
          return { ...v, steps: [...presetSteps] };
        }
        return v;
      })
    );
  };

  const handleCommit = () => {
    const patternRecord: Record<string, boolean[]> = {};
    voices.forEach((v) => {
      patternRecord[v.id] = v.steps;
    });
    const presetName = BEAT_PRESETS.find((p) => p.id === selectedPresetId)?.name || 'Custom Beat';
    onCommitToTimeline(patternRecord, commitBar, presetName);
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#101114',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#17191E',
          border: '1px solid #252932',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-round" style={{ color: '#8B78FF', fontSize: '20px' }}>
              grid_view
            </span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#F3F4F6' }}>
              Step Sequencer & Drum Matrix
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                backgroundColor: '#252932',
                borderRadius: '12px',
                color: '#9CA3AF',
                fontWeight: 600,
              }}
            >
              16 Steps / Bar
            </span>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#252932' }} />

          {/* Preset Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>Genre Preset:</span>
            <select
              value={selectedPresetId}
              onChange={(e) => {
                const found = BEAT_PRESETS.find((p) => p.id === e.target.value);
                if (found) handleLoadPreset(found);
              }}
              style={{
                height: '28px',
                backgroundColor: '#1D2027',
                border: '1px solid #323744',
                borderRadius: '4px',
                color: '#F3F4F6',
                padding: '0 8px',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {BEAT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.bpm} BPM)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Commitment to Timeline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Place at Bar:</span>
            <input
              type="number"
              min={1}
              max={64}
              value={commitBar}
              onChange={(e) => setCommitBar(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{
                width: '48px',
                height: '28px',
                backgroundColor: '#1D2027',
                border: '1px solid #323744',
                borderRadius: '4px',
                color: '#F3F4F6',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 600,
              }}
            />
          </div>

          <button
            onClick={handleCommit}
            style={{
              height: '30px',
              padding: '0 14px',
              borderRadius: '5px',
              backgroundColor: '#8B78FF',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '15px' }}>add_to_photos</span>
            <span>Commit Pattern to Timeline</span>
          </button>
        </div>
      </div>

      {/* Sequencer Grid Container */}
      <div
        style={{
          backgroundColor: '#17191E',
          border: '1px solid #252932',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Step Numbers Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px' }}>
          <div style={{ width: '220px', flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#697180', textTransform: 'uppercase' }}>
            Drum Voice
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
            {Array.from({ length: 16 }).map((_, stepIdx) => {
              const isGroupStart = stepIdx % 4 === 0;
              const isPlayheadHere = isPlaying && activeStep === stepIdx;
              return (
                <div
                  key={stepIdx}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '10px',
                    fontWeight: isGroupStart ? 700 : 500,
                    color: isPlayheadHere ? '#8B78FF' : isGroupStart ? '#F3F4F6' : '#697180',
                    borderBottom: isPlayheadHere ? '2px solid #8B78FF' : '2px solid transparent',
                    paddingBottom: '4px',
                  }}
                >
                  {stepIdx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice Rows */}
        {voices.map((voice) => {
          return (
            <div
              key={voice.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1D2027',
                border: '1px solid #252932',
                borderRadius: '6px',
                padding: '6px 10px',
              }}
            >
              {/* Voice Header */}
              <div style={{ width: '220px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  onClick={() => handleAudition(voice.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title="Click to preview sound"
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: voice.color }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#F3F4F6' }}>
                    {voice.name}
                  </span>
                </div>

                {/* Quick Pattern Tools */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button
                    onClick={() => handleFillInterval(voice.id, 4)}
                    style={{
                      height: '20px',
                      padding: '0 5px',
                      backgroundColor: '#252932',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#9CA3AF',
                      fontSize: '9px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Fill every 4 steps"
                  >
                    4/4
                  </button>
                  <button
                    onClick={() => handleFillInterval(voice.id, 2)}
                    style={{
                      height: '20px',
                      padding: '0 5px',
                      backgroundColor: '#252932',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#9CA3AF',
                      fontSize: '9px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Fill every 2 steps"
                  >
                    2/4
                  </button>
                  <button
                    onClick={() => handleShiftVoice(voice.id, -1)}
                    style={{
                      height: '20px',
                      width: '20px',
                      backgroundColor: '#252932',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#9CA3AF',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Shift left"
                  >
                    <span className="material-icons-round" style={{ fontSize: '12px' }}>chevron_left</span>
                  </button>
                  <button
                    onClick={() => handleShiftVoice(voice.id, 1)}
                    style={{
                      height: '20px',
                      width: '20px',
                      backgroundColor: '#252932',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#9CA3AF',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Shift right"
                  >
                    <span className="material-icons-round" style={{ fontSize: '12px' }}>chevron_right</span>
                  </button>
                  <button
                    onClick={() => handleClearVoice(voice.id)}
                    style={{
                      height: '20px',
                      width: '20px',
                      backgroundColor: '#252932',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#697180',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Clear channel steps"
                  >
                    <span className="material-icons-round" style={{ fontSize: '12px' }}>close</span>
                  </button>
                </div>
              </div>

              {/* 16 Step Buttons */}
              <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                {voice.steps.map((isActive, stepIdx) => {
                  const isBeatQuarter = Math.floor(stepIdx / 4) % 2 === 0;
                  const isPlayheadHere = isPlaying && activeStep === stepIdx;

                  let bgColor = isBeatQuarter ? '#252932' : '#1A1D24';
                  let borderColor = isPlayheadHere ? '#8B78FF' : '#323744';

                  if (isActive) {
                    bgColor = voice.color;
                    borderColor = voice.color;
                  }

                  return (
                    <button
                      key={stepIdx}
                      onClick={() => handleToggleStep(voice.id, stepIdx)}
                      style={{
                        flex: 1,
                        height: '32px',
                        backgroundColor: bgColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.05s',
                        position: 'relative',
                        boxShadow: isActive ? `0 0 6px ${voice.color}44` : 'none',
                      }}
                      title={`Step ${stepIdx + 1} (${isActive ? 'Active' : 'Empty'})`}
                    >
                      {isPlayheadHere && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '3px',
                          }}
                        />
                      )}
                    </button>
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


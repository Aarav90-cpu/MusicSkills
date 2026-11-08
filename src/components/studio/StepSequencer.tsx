import React from 'react';
import { dawAudioEngine } from '../../utils/dawAudioEngine';

interface StepSequencerProps {
  drumSteps: {
    kick: boolean[];
    snare: boolean[];
    hihatClosed: boolean[];
    hihatOpen: boolean[];
    clap: boolean[];
    sub808: boolean[];
    perc: boolean[];
  };
  onToggleStep: (voice: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'clap' | 'sub808' | 'perc', stepIndex: number) => void;
  onClearVoice: (voice: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'clap' | 'sub808' | 'perc') => void;
  onFillVoice: (voice: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'clap' | 'sub808' | 'perc', interval: number) => void;
  currentStepIndex: number; // 0 to 15 (current 16th note)
  isPlaying: boolean;
}

const VOICES: Array<{
  id: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'clap' | 'sub808' | 'perc';
  label: string;
  icon: string;
  color: string;
}> = [
  { id: 'kick', label: 'Kick Drum', icon: 'album', color: '#ff5252' },
  { id: 'snare', label: 'Snare Snap', icon: 'radio_button_checked', color: '#ff9800' },
  { id: 'hihatClosed', label: 'Closed Hat', icon: 'fiber_manual_record', color: '#ffd600' },
  { id: 'hihatOpen', label: 'Open Hat', icon: 'panorama_fish_eye', color: '#00e676' },
  { id: 'clap', label: 'Hand Clap', icon: 'pan_tool', color: '#00b0ff' },
  { id: 'sub808', label: '808 Sub Bass', icon: 'speaker', color: '#7c4dff' },
  { id: 'perc', label: 'Perc / Rim', icon: 'blur_on', color: '#ff4081' },
];

export const StepSequencer: React.FC<StepSequencerProps> = ({
  drumSteps,
  onToggleStep,
  onClearVoice,
  onFillVoice,
  currentStepIndex,
  isPlaying,
}) => {
  const handleAuditionVoice = (voiceId: string) => {
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
    }
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
      {/* Sequencer Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
            grid_view
          </span>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
            Step Sequencer (LMMS Beat & Bassline)
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
            16 Steps / Bar
          </span>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Click step to toggle / Click voice title to preview sound
        </div>
      </div>

      {/* Step Grid Header: 1 to 16 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '160px', flexShrink: 0, fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
          Voice
        </div>
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {Array.from({ length: 16 }).map((_, step) => {
            const isCurrent = isPlaying && currentStepIndex % 16 === step;
            const isBeatStart = step % 4 === 0;
            return (
              <div
                key={step}
                style={{
                  flex: 1,
                  minWidth: '24px',
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: isBeatStart ? 700 : 500,
                  color: isCurrent ? 'var(--color-primary)' : isBeatStart ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  borderBottom: isCurrent ? '2px solid var(--color-primary)' : '2px solid transparent',
                  paddingBottom: '2px',
                }}
              >
                {step + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* Voice Rows */}
      {VOICES.map(voice => {
        const steps = drumSteps[voice.id] || Array(16).fill(false);
        return (
          <div
            key={voice.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0',
              borderRadius: '6px',
            }}
          >
            {/* Voice Control Header */}
            <div
              style={{
                width: '160px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                backgroundColor: 'var(--color-container)',
                borderRadius: '8px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => handleAuditionVoice(voice.id)}
              title="Click to audition voice"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: voice.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {voice.label}
                </span>
              </div>

              {/* Quick Actions Dropdown / Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn-text"
                  onClick={() => onFillVoice(voice.id, 4)}
                  title="Fill every 4 steps"
                  style={{ width: '20px', height: '20px', padding: 0, fontSize: '10px' }}
                >
                  /4
                </button>
                <button
                  className="btn-text"
                  onClick={() => onFillVoice(voice.id, 2)}
                  title="Fill every 2 steps"
                  style={{ width: '20px', height: '20px', padding: 0, fontSize: '10px' }}
                >
                  /2
                </button>
                <button
                  className="btn-text"
                  onClick={() => onClearVoice(voice.id)}
                  title="Clear voice track"
                  style={{ width: '20px', height: '20px', padding: 0 }}
                >
                  <span className="material-icons-round" style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    clear
                  </span>
                </button>
              </div>
            </div>

            {/* Step Buttons (16 Steps) */}
            <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
              {steps.map((isActive, stepIdx) => {
                const isCurrent = isPlaying && currentStepIndex % 16 === stepIdx;
                const isGroupOfFour = Math.floor(stepIdx / 4) % 2 === 0;

                return (
                  <button
                    key={stepIdx}
                    onClick={() => {
                      onToggleStep(voice.id, stepIdx);
                      if (!isActive) handleAuditionVoice(voice.id);
                    }}
                    style={{
                      flex: 1,
                      minWidth: '24px',
                      height: '34px',
                      borderRadius: '6px',
                      border: isCurrent
                        ? '1px solid var(--color-primary)'
                        : '1px solid var(--color-outline)',
                      backgroundColor: isActive
                        ? voice.color
                        : isGroupOfFour
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(255, 255, 255, 0.02)',
                      color: isActive ? '#000000' : 'transparent',
                      cursor: 'pointer',
                      transition: 'transform 0.05s ease, background-color 0.1s ease',
                      boxShadow: isActive ? `0 0 8px ${voice.color}66` : 'none',
                      position: 'relative',
                    }}
                    title={`Step ${stepIdx + 1}: ${isActive ? 'Active' : 'Empty'}`}
                  >
                    {isCurrent && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
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
  );
};


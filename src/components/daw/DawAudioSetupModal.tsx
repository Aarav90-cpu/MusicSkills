/**
 * MusicSkills - DAW Audio Setup & Hardware Device Inspector Modal
 * Real-time monitoring of Web Audio context state, buffer latency,
 * physical USB MIDI input controllers, and audio output calibration.
 * Strictly zero-emoji.
 */

import React from 'react';
import { dawContextManager } from '../../utils/daw/audioContext';
import { MidiDeviceInfo } from '../../utils/daw/midiEngine';
import { dawSynthEngine } from '../../utils/daw/synthEngine';

interface DawAudioSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  midiDevices: MidiDeviceInfo[];
  activeChannelsCount: number;
}

export const DawAudioSetupModal: React.FC<DawAudioSetupModalProps> = ({
  isOpen,
  onClose,
  midiDevices,
  activeChannelsCount,
}) => {
  if (!isOpen) return null;

  const handleTestAudioOutput = () => {
    const ctx = dawContextManager.getContext();
    const t = ctx.currentTime;
    // Play test chord: C4, E4, G4, B4
    ['C4', 'E4', 'G4', 'B4'].forEach((pitch, idx) => {
      dawSynthEngine.playNote(pitch, 0.6, 0.75, 'bell', ctx.destination, t + idx * 0.08);
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        userSelect: 'none',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '560px',
          maxWidth: '100%',
          backgroundColor: '#17191E',
          border: '1px solid #252932',
          borderRadius: '10px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            height: '46px',
            backgroundColor: '#1D2027',
            borderBottom: '1px solid #252932',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-round" style={{ color: '#35C9A5', fontSize: '18px' }}>settings</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#F3F4F6' }}>
              Audio Engine & Hardware Settings
            </span>
          </div>

          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', backgroundColor: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Audio Engine Parameters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.05em' }}>
              Web Audio Processing Core
            </span>
            <div
              style={{
                backgroundColor: '#101114',
                border: '1px solid #252932',
                borderRadius: '6px',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: '#697180' }}>Engine State:</span>
                <div style={{ fontWeight: 700, color: '#35C9A5', textTransform: 'uppercase', marginTop: '2px' }}>
                  {dawContextManager.getState()}
                </div>
              </div>

              <div>
                <span style={{ color: '#697180' }}>Sample Rate:</span>
                <div style={{ fontWeight: 700, color: '#F3F4F6', fontFamily: 'monospace', marginTop: '2px' }}>
                  {dawContextManager.getSampleRate()} Hz
                </div>
              </div>

              <div>
                <span style={{ color: '#697180' }}>Latency Mode:</span>
                <div style={{ fontWeight: 700, color: '#F3F4F6', marginTop: '2px' }}>
                  Interactive (~5.8 ms buffer)
                </div>
              </div>

              <div>
                <span style={{ color: '#697180' }}>Mixer Routing Channels:</span>
                <div style={{ fontWeight: 700, color: '#F3F4F6', marginTop: '2px' }}>
                  {activeChannelsCount} Active Strips + Master
                </div>
              </div>
            </div>
          </div>

          {/* Connected Web MIDI Devices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.05em' }}>
              USB MIDI Controllers ({midiDevices.length})
            </span>
            <div
              style={{
                backgroundColor: '#101114',
                border: '1px solid #252932',
                borderRadius: '6px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {midiDevices.length > 0 ? (
                midiDevices.map((dev) => (
                  <div key={dev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons-round" style={{ fontSize: '16px', color: '#35C9A5' }}>piano</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#F3F4F6' }}>{dev.name}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'capitalize' }}>{dev.state}</span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '12px', color: '#697180' }}>
                  No external USB MIDI keyboard detected. Connect any standard USB MIDI device to trigger instruments live.
                </span>
              )}
            </div>
          </div>

          {/* Audio Output Test */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#1D2027',
              border: '1px solid #252932',
              borderRadius: '6px',
              padding: '12px 14px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F3F4F6' }}>Audio Output Calibration</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Verify master bus playback and stereo monitors</div>
            </div>

            <button
              onClick={handleTestAudioOutput}
              style={{
                padding: '6px 14px',
                backgroundColor: '#252932',
                border: '1px solid #35C9A5',
                color: '#35C9A5',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '14px' }}>volume_up</span>
              <span>Test Audio</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#1D2027',
            borderTop: '1px solid #252932',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#8B78FF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


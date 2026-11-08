/**
 * MusicSkills Professional DAW - About Modal
 * Technical specifications, version info, engine architecture.
 * Strictly zero-emoji.
 */

import React from 'react';

interface DawAboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleRate: number;
}

export const DawAboutModal: React.FC<DawAboutModalProps> = ({ isOpen, onClose, sampleRate }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '500px',
          backgroundColor: '#17191E',
          border: '1px solid #2D3139',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#F3F4F6' }}>
              MusicSkills DAW Studio
            </h3>
            <span style={{ fontSize: '11px', color: '#8B78FF', fontWeight: 600 }}>
              Studio Edition
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </div>

        <p style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: 1.5, margin: '0 0 16px' }}>
          MusicSkills DAW is a desktop-grade Digital Audio Workstation engineered with genuine Web Audio API DSP synthesis, real-time mixing consoles, hardware Web MIDI integration, and offline multi-track stem rendering.
        </p>

        <div
          style={{
            backgroundColor: '#111216',
            border: '1px solid #22252C',
            borderRadius: '6px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#CBD5E1',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#697180' }}>DSP Processing Core:</span>
            <span style={{ color: '#35C9A5' }}>Web Audio API (Float32)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#697180' }}>Hardware Sample Rate:</span>
            <span>{sampleRate} Hz</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#697180' }}>MIDI Subsystem:</span>
            <span style={{ color: '#8B78FF' }}>Web MIDI API (Low Latency)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#697180' }}>Master Limiter:</span>
            <span>0 dBFS True Peak Lookahead</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#697180' }}>Offline WAV Renderer:</span>
            <span>24-bit PCM Multi-Channel</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#697180' }}>Local Storage Engine:</span>
            <span>Autosave & Session Library</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#8B78FF',
              border: 'none',
              borderRadius: '4px',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 600,
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

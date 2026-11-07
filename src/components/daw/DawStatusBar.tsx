import React from 'react';

interface DawStatusBarProps {
  engineState: AudioContextState | string;
  sampleRate: number;
  tracksCount: number;
  clipsCount: number;
  lastSavedAt: string;
}

export const DawStatusBar: React.FC<DawStatusBarProps> = ({
  engineState,
  sampleRate,
  tracksCount,
  clipsCount,
  lastSavedAt,
}) => {
  return (
    <footer
      style={{
        height: '24px',
        backgroundColor: '#101114',
        borderTop: '1px solid #1D2027',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: '#697180',
        userSelect: 'none',
        flexShrink: 0,
        fontFamily: 'monospace',
      }}
    >
      {/* Left: Engine Status & Audio Device Specs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: engineState === 'running' ? '#35C9A5' : '#F5C451',
            }}
          />
          <span style={{ color: '#F3F4F6' }}>
            Audio Engine: {engineState.toUpperCase()}
          </span>
        </div>

        <span>·</span>
        <span>{(sampleRate / 1000).toFixed(1)} kHz</span>
        <span>·</span>
        <span>256 Samples (~5.8ms)</span>
      </div>

      {/* Right: Project Stats & Autosave */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>{tracksCount} Tracks</span>
        <span>·</span>
        <span>{clipsCount} Clips</span>
        <span>·</span>
        <span style={{ color: '#9CA3AF' }}>Autosaved: {lastSavedAt || 'Ready'}</span>
      </div>
    </footer>
  );
};

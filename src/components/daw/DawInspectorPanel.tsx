import React from 'react';
import { DawTrack, DawClip } from '../../utils/daw/projectModel';

interface DawInspectorPanelProps {
  selectedTrack: DawTrack | null;
  selectedClip: DawClip | null;
  onUpdateTrack: (trackId: string, updates: Partial<DawTrack>) => void;
  onUpdateClip: (clipId: string, updates: Partial<DawClip>) => void;
  onDeleteClip: (clipId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onOpenEffectsRack: (trackId: string) => void;
}

export const DawInspectorPanel: React.FC<DawInspectorPanelProps> = ({
  selectedTrack,
  selectedClip,
  onUpdateTrack,
  onUpdateClip,
  onDeleteClip,
  onDeleteTrack,
  onOpenEffectsRack,
}) => {
  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#17191E',
        borderLeft: '1px solid #1D2027',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      {/* Inspector Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #1D2027',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.05em' }}>
          Inspector
        </span>
        <span style={{ fontSize: '11px', color: '#697180' }}>
          {selectedClip ? 'Clip Focus' : selectedTrack ? 'Track Focus' : 'Project'}
        </span>
      </div>

      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 1. Selected Clip Section */}
        {selectedClip ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#35C9A5' }}>
                Clip Properties
              </span>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#9CA3AF', backgroundColor: '#252932', padding: '2px 6px', borderRadius: '3px' }}>
                {selectedClip.type}
              </span>
            </div>

            <div>
              <label style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Clip Name</label>
              <input
                type="text"
                value={selectedClip.name}
                onChange={(e) => onUpdateClip(selectedClip.id, { name: e.target.value })}
                style={{
                  width: '100%',
                  height: '28px',
                  backgroundColor: '#101114',
                  border: '1px solid #252932',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                  padding: '0 8px',
                  marginTop: '4px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Start Bar</label>
                <input
                  type="number"
                  min="1"
                  max="128"
                  value={selectedClip.startBar}
                  onChange={(e) => onUpdateClip(selectedClip.id, { startBar: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  style={{
                    width: '100%',
                    height: '28px',
                    backgroundColor: '#101114',
                    border: '1px solid #252932',
                    borderRadius: '4px',
                    color: '#F3F4F6',
                    fontSize: '12px',
                    padding: '0 8px',
                    marginTop: '4px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Duration (Bars)</label>
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={selectedClip.durationBars}
                  onChange={(e) => onUpdateClip(selectedClip.id, { durationBars: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  style={{
                    width: '100%',
                    height: '28px',
                    backgroundColor: '#101114',
                    border: '1px solid #252932',
                    borderRadius: '4px',
                    color: '#F3F4F6',
                    fontSize: '12px',
                    padding: '0 8px',
                    marginTop: '4px',
                  }}
                />
              </div>
            </div>

            {selectedClip.type === 'audio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #252932', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Pitch Shift (Semitones)</span>
                  <input
                    type="number"
                    min="-24"
                    max="24"
                    value={selectedClip.pitchShiftSemitones || 0}
                    onChange={(e) => onUpdateClip(selectedClip.id, { pitchShiftSemitones: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: '48px', height: '24px', backgroundColor: '#101114', border: '1px solid #252932', color: '#F3F4F6', fontSize: '11px', textAlign: 'center', borderRadius: '3px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Reverse Audio</span>
                  <button
                    onClick={() => onUpdateClip(selectedClip.id, { isReversed: !selectedClip.isReversed })}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: selectedClip.isReversed ? '#8B78FF' : '#252932',
                      color: selectedClip.isReversed ? '#FFFFFF' : '#9CA3AF',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    {selectedClip.isReversed ? 'Reversed' : 'Forward'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => onDeleteClip(selectedClip.id)}
              style={{
                height: '28px',
                backgroundColor: 'rgba(255, 82, 82, 0.1)',
                border: '1px solid #FF5252',
                color: '#FF5252',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              Delete Selected Clip
            </button>
          </div>
        ) : null}

        {/* 2. Selected Track Section */}
        {selectedTrack && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: selectedClip ? '1px solid #252932' : 'none', paddingTop: selectedClip ? '12px' : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#8B78FF' }}>
                Track Settings
              </span>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#9CA3AF', backgroundColor: '#252932', padding: '2px 6px', borderRadius: '3px' }}>
                {selectedTrack.type}
              </span>
            </div>

            <div>
              <label style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Track Name</label>
              <input
                type="text"
                value={selectedTrack.name}
                onChange={(e) => onUpdateTrack(selectedTrack.id, { name: e.target.value })}
                style={{
                  width: '100%',
                  height: '28px',
                  backgroundColor: '#101114',
                  border: '1px solid #252932',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                  padding: '0 8px',
                  marginTop: '4px',
                }}
              />
            </div>

            {/* Effects Rack Launcher Button */}
            <button
              onClick={() => onOpenEffectsRack(selectedTrack.id)}
              style={{
                height: '34px',
                backgroundColor: '#252932',
                border: '1px solid #8B78FF',
                borderRadius: '4px',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
              title="Open EQ, Compressor, Delay, and Reverb effect chain"
            >
              <span className="material-icons-round" style={{ fontSize: '16px', color: '#8B78FF' }}>tune</span>
              <span>Open Insert FX Rack</span>
            </button>

            {/* Track Color Palette */}
            <div>
              <label style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>Track Color</label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {['#FF5252', '#FF9800', '#F5C451', '#35C9A5', '#00B0FF', '#8B78FF', '#E9A45B'].map((color) => (
                  <div
                    key={color}
                    onClick={() => onUpdateTrack(selectedTrack.id, { color })}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      cursor: 'pointer',
                      border: selectedTrack.color === color ? '2px solid #FFFFFF' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => onDeleteTrack(selectedTrack.id)}
              style={{
                height: '28px',
                backgroundColor: 'transparent',
                border: '1px solid #252932',
                color: '#9CA3AF',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: '6px',
              }}
            >
              Delete Track
            </button>
          </div>
        )}

        {!selectedClip && !selectedTrack && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#697180', fontSize: '12px' }}>
            Click any clip or track header to inspect and adjust its parameters.
          </div>
        )}
      </div>
    </aside>
  );
};

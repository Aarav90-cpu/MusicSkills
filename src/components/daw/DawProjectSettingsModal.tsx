/**
 * MusicSkills Professional DAW - Project Settings & Session Configuration Modal
 * Adjust global project parameters: BPM, Key, Time Signature, Snap, Timeline Length.
 * Strictly zero-emoji.
 */

import React, { useState } from 'react';
import { DawProject } from '../../utils/daw/projectModel';

interface DawProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DawProject;
  onUpdateSettings: (settings: Partial<DawProject>) => void;
  onShowSnackbar: (msg: string) => void;
}

export const DawProjectSettingsModal: React.FC<DawProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateSettings,
  onShowSnackbar,
}) => {
  const [name, setName] = useState(project.name);
  const [bpm, setBpm] = useState(project.bpm);
  const [num, setNum] = useState(project.timeSignatureNumerator);
  const [den, setDen] = useState(project.timeSignatureDenominator);
  const [key, setKey] = useState(project.key);
  const [scale, setScale] = useState(project.scale);
  const [totalBars, setTotalBars] = useState(project.totalBars);
  const [snap, setSnap] = useState(project.snapResolution);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateSettings({
      name,
      bpm: Math.max(40, Math.min(300, bpm)),
      timeSignatureNumerator: num,
      timeSignatureDenominator: den,
      key,
      scale,
      totalBars: Math.max(8, Math.min(128, totalBars)),
      snapResolution: snap,
    });
    onShowSnackbar('Project settings updated.');
    onClose();
  };

  const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const SCALES = ['major', 'minor', 'dorian', 'mixolydian', 'pentatonic', 'blues'];

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
          width: '460px',
          backgroundColor: '#17191E',
          border: '1px solid #2D3139',
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#F3F4F6' }}>
            Project Settings
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Project Name */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
              Project Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: '#111216',
                border: '1px solid #2D3139',
                borderRadius: '4px',
                color: '#F3F4F6',
                fontSize: '12px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Tempo & Time Signature */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Tempo (BPM)
              </label>
              <input
                type="number"
                min={40}
                max={300}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: '#111216',
                  border: '1px solid #2D3139',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Time Signature
              </label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <select
                  value={num}
                  onChange={(e) => setNum(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: '6px',
                    backgroundColor: '#111216',
                    border: '1px solid #2D3139',
                    borderRadius: '4px',
                    color: '#F3F4F6',
                    fontSize: '12px',
                  }}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                  <option value={7}>7</option>
                </select>
                <span style={{ color: '#9CA3AF' }}>/</span>
                <select
                  value={den}
                  onChange={(e) => setDen(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: '6px',
                    backgroundColor: '#111216',
                    border: '1px solid #2D3139',
                    borderRadius: '4px',
                    color: '#F3F4F6',
                    fontSize: '12px',
                  }}
                >
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                </select>
              </div>
            </div>
          </div>

          {/* Root Key & Scale */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Root Key
              </label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#111216',
                  border: '1px solid #2D3139',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                }}
              >
                {KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Scale / Mode
              </label>
              <select
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#111216',
                  border: '1px solid #2D3139',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                }}
              >
                {SCALES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeline Length & Grid Snap */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Timeline Length (Bars)
              </label>
              <select
                value={totalBars}
                onChange={(e) => setTotalBars(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#111216',
                  border: '1px solid #2D3139',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                }}
              >
                <option value={8}>8 Bars</option>
                <option value={16}>16 Bars</option>
                <option value={24}>24 Bars</option>
                <option value={32}>32 Bars</option>
                <option value={64}>64 Bars</option>
                <option value={128}>128 Bars</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                Grid Snap Resolution
              </label>
              <select
                value={snap}
                onChange={(e) => setSnap(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#111216',
                  border: '1px solid #2D3139',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '12px',
                }}
              >
                <option value="1/1">1 Bar</option>
                <option value="1/2">1/2 Note</option>
                <option value="1/4">1/4 Note (Beat)</option>
                <option value="1/8">1/8 Note</option>
                <option value="1/16">1/16 Note</option>
                <option value="free">Free (Off)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2A2E37',
              border: 'none',
              borderRadius: '4px',
              color: '#F3F4F6',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
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
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};


/**
 * MusicSkills - DAW Keyboard Shortcuts Reference Dialog
 * Dark-themed modal providing complete documentation of DAW hotkeys.
 * Strictly zero-emoji.
 */

import React from 'react';

interface DawShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DawShortcutsModal: React.FC<DawShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const SHORTCUT_GROUPS = [
    {
      category: 'Transport & Playback',
      shortcuts: [
        { key: 'Space', desc: 'Play / Stop timeline playback' },
        { key: 'R', desc: 'Toggle audio/MIDI recording into armed track' },
        { key: 'L', desc: 'Toggle timeline loop mode' },
        { key: 'Home / Return', desc: 'Return playhead to project start' },
      ],
    },
    {
      category: 'Arrangement Tools',
      shortcuts: [
        { key: '1', desc: 'Pointer tool: Selection, clip drag and resize' },
        { key: '2', desc: 'Draw tool: Insert new clip at lane position' },
        { key: '3', desc: 'Erase tool: Delete clip on click' },
        { key: '4', desc: 'Split tool: Slice clip at playhead or click' },
        { key: '5', desc: 'Mute tool: Toggle clip active status' },
        { key: 'Q', desc: 'Quantize: Snap notes in active clip to grid' },
      ],
    },
    {
      category: 'Musical Typing (Computer Keyboard MIDI)',
      shortcuts: [
        { key: 'A, W, S, E, D, F, T...', desc: 'Play chromatic piano/synth notes' },
        { key: 'Z / X', desc: 'Shift keyboard octave down / up' },
        { key: 'KB MIDI button', desc: 'Enable / disable musical typing mode' },
        { key: 'Record (R)', desc: 'Record notes into armed track timeline' },
      ],
    },
    {
      category: 'Workspace & Panels',
      shortcuts: [
        { key: 'B', desc: 'Toggle Sample Browser & Sound Library sidebar' },
        { key: 'M', desc: 'Toggle Multi-Channel Mixing Console' },
        { key: 'I', desc: 'Toggle Clip & Track Inspector panel' },
        { key: 'Ctrl + S', desc: 'Save project session snapshot' },
        { key: 'Ctrl + Z', desc: 'Undo last action' },
        { key: 'Ctrl + Shift + Z', desc: 'Redo previously undone action' },
      ],
    },
    {
      category: 'Piano Roll & Step Sequencer',
      shortcuts: [
        { key: 'Double Click Clip', desc: 'Open MIDI clip in Piano Roll editor' },
        { key: 'Click Key', desc: 'Audition chromatic pitch through synth' },
        { key: 'Click Drum Step', desc: 'Toggle step in beat matrix' },
        { key: 'USB MIDI Keyboard', desc: 'Play polyphonic notes into armed track' },
      ],
    },
  ];

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
          width: '620px',
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
            <span className="material-icons-round" style={{ color: '#8B78FF', fontSize: '18px' }}>keyboard</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#F3F4F6' }}>
              Keyboard Shortcuts & Controls
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
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '70vh', overflowY: 'auto' }}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#8B78FF', letterSpacing: '0.05em' }}>
                {group.category}
              </span>
              <div
                style={{
                  backgroundColor: '#101114',
                  border: '1px solid #252932',
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}
              >
                {group.shortcuts.map((item, idx) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: idx < group.shortcuts.length - 1 ? '1px solid #1D2027' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#F3F4F6' }}>
                      {item.desc}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#252932',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#35C9A5',
                        fontWeight: 700,
                      }}
                    >
                      {item.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
};


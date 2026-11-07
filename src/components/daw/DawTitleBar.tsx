import React, { useState } from 'react';

interface DawTitleBarProps {
  projectName: string;
  isDirty: boolean;
  onRenameProject: (name: string) => void;
  activeWorkspace: 'arrangement' | 'pianoroll' | 'stepsequencer' | 'mixer';
  onChangeWorkspace: (ws: 'arrangement' | 'pianoroll' | 'stepsequencer' | 'mixer') => void;
  onExit: () => void;
  midiConnectedCount?: number;
}

export const DawTitleBar: React.FC<DawTitleBarProps> = ({
  projectName,
  isDirty,
  onRenameProject,
  activeWorkspace,
  onChangeWorkspace,
  onExit,
  midiConnectedCount = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(projectName);

  const handleSave = () => {
    if (tempName.trim()) {
      onRenameProject(tempName.trim());
    }
    setIsEditing(false);
  };

  return (
    <header
      style={{
        height: '40px',
        backgroundColor: '#101114',
        borderBottom: '1px solid #1D2027',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Left: App Logo, Name & Project Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={onExit}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '18px' }}>
            <div style={{ width: '3px', height: '10px', borderRadius: '1px', backgroundColor: '#8B78FF' }} />
            <div style={{ width: '3px', height: '18px', borderRadius: '1px', backgroundColor: '#35C9A5' }} />
            <div style={{ width: '3px', height: '14px', borderRadius: '1px', backgroundColor: '#8B78FF' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.02em', color: '#F3F4F6' }}>
            MusicSkills DAW
          </span>
        </div>

        <div style={{ width: '1px', height: '16px', backgroundColor: '#252932' }} />

        {/* Project Name & Dirty Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isEditing ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
              style={{
                height: '24px',
                backgroundColor: '#17191E',
                border: '1px solid #8B78FF',
                borderRadius: '4px',
                color: '#F3F4F6',
                padding: '0 8px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            />
          ) : (
            <div
              onClick={() => {
                setTempName(projectName);
                setIsEditing(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
              title="Click to rename project"
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#F3F4F6' }}>
                {projectName}
              </span>
              {isDirty && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#F5C451',
                  }}
                  title="Unsaved changes"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Centre: Workspace Mode Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#17191E', padding: '2px', borderRadius: '6px', border: '1px solid #252932' }}>
        <button
          onClick={() => onChangeWorkspace('arrangement')}
          style={{
            height: '26px',
            padding: '0 12px',
            fontSize: '11px',
            fontWeight: activeWorkspace === 'arrangement' ? 700 : 500,
            borderRadius: '4px',
            backgroundColor: activeWorkspace === 'arrangement' ? '#8B78FF' : 'transparent',
            color: activeWorkspace === 'arrangement' ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Arrangement
        </button>
        <button
          onClick={() => onChangeWorkspace('pianoroll')}
          style={{
            height: '26px',
            padding: '0 12px',
            fontSize: '11px',
            fontWeight: activeWorkspace === 'pianoroll' ? 700 : 500,
            borderRadius: '4px',
            backgroundColor: activeWorkspace === 'pianoroll' ? '#8B78FF' : 'transparent',
            color: activeWorkspace === 'pianoroll' ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Piano Roll
        </button>
        <button
          onClick={() => onChangeWorkspace('stepsequencer')}
          style={{
            height: '26px',
            padding: '0 12px',
            fontSize: '11px',
            fontWeight: activeWorkspace === 'stepsequencer' ? 700 : 500,
            borderRadius: '4px',
            backgroundColor: activeWorkspace === 'stepsequencer' ? '#8B78FF' : 'transparent',
            color: activeWorkspace === 'stepsequencer' ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Step Sequencer
        </button>
        <button
          onClick={() => onChangeWorkspace('mixer')}
          style={{
            height: '26px',
            padding: '0 12px',
            fontSize: '11px',
            fontWeight: activeWorkspace === 'mixer' ? 700 : 500,
            borderRadius: '4px',
            backgroundColor: activeWorkspace === 'mixer' ? '#8B78FF' : 'transparent',
            color: activeWorkspace === 'mixer' ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Mixer Console
        </button>
      </div>

      {/* Right: MIDI Status & Exit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#17191E',
            border: '1px solid #252932',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            color: midiConnectedCount > 0 ? '#35C9A5' : '#697180',
          }}
          title={midiConnectedCount > 0 ? `${midiConnectedCount} MIDI device(s) connected and active` : 'Web MIDI ready for USB keyboard input'}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: midiConnectedCount > 0 ? '#35C9A5' : '#4B5563',
            }}
          />
          <span>{midiConnectedCount > 0 ? `MIDI IN (${midiConnectedCount})` : 'MIDI IN'}</span>
        </div>

        <button
          onClick={onExit}
          style={{
            height: '26px',
            padding: '0 10px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '4px',
            backgroundColor: '#252932',
            color: '#9CA3AF',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Return to Studio Overview"
        >
          <span className="material-icons-round" style={{ fontSize: '14px' }}>arrow_back</span>
          <span>Exit DAW</span>
        </button>
      </div>
    </header>
  );
};

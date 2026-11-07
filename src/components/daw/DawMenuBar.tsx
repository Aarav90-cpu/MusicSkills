import React, { useState, useEffect, useRef } from 'react';

export interface MenuActionHandlers {
  onNewProject: () => void;
  onSaveProject: () => void;
  onSaveAsCopy: () => void;
  onExportMaster: () => void;
  onExportStems: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoDesc: string;
  redoDesc: string;
  onToggleBrowser: () => void;
  onToggleInspector: () => void;
  onToggleMixer: () => void;
  onSelectWorkspace?: (ws: 'arrangement' | 'pianoroll' | 'stepsequencer' | 'mixer') => void;
  onAddAudioTrack: () => void;
  onAddMidiTrack: () => void;
  onAddInstrumentTrack: () => void;
  onAddDrumTrack?: () => void;
  onDeleteSelectedTrack: () => void;
  onSplitClipAtPlayhead: () => void;
  onQuantizeClip: () => void;
  onShowShortcuts: () => void;
  onShowAudioSetup: () => void;
}

interface DawMenuBarProps {
  handlers: MenuActionHandlers;
}

export const DawMenuBar: React.FC<DawMenuBarProps> = ({ handlers }) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  const MENUS: Array<{
    id: string;
    label: string;
    items: Array<{
      id: string;
      label: string;
      shortcut?: string;
      disabled?: boolean;
      separator?: boolean;
      action: () => void;
    }>;
  }> = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New Project', shortcut: 'Ctrl+N', action: handlers.onNewProject },
        { id: 'save', label: 'Save Session', shortcut: 'Ctrl+S', action: handlers.onSaveProject },
        { id: 'save_copy', label: 'Save a Copy / Cover', action: handlers.onSaveAsCopy },
        { id: 'sep1', label: '', separator: true, action: () => {} },
        { id: 'exp_wav', label: 'Export Audio Master (WAV)', shortcut: 'Ctrl+Shift+E', action: handlers.onExportMaster },
        { id: 'exp_stems', label: 'Export Track Stems (.zip)', action: handlers.onExportStems },
        { id: 'sep2', label: '', separator: true, action: () => {} },
        { id: 'prefs', label: 'Audio Device Setup...', action: handlers.onShowAudioSetup },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        {
          id: 'undo',
          label: handlers.undoDesc ? `Undo ${handlers.undoDesc}` : 'Undo',
          shortcut: 'Ctrl+Z',
          disabled: !handlers.canUndo,
          action: handlers.onUndo,
        },
        {
          id: 'redo',
          label: handlers.redoDesc ? `Redo ${handlers.redoDesc}` : 'Redo',
          shortcut: 'Ctrl+Shift+Z',
          disabled: !handlers.canRedo,
          action: handlers.onRedo,
        },
        { id: 'sep_e1', label: '', separator: true, action: () => {} },
        { id: 'split', label: 'Split Clip at Playhead', shortcut: 'S', action: handlers.onSplitClipAtPlayhead },
        { id: 'quantize', label: 'Quantize Notes / Clip', shortcut: 'Q', action: handlers.onQuantizeClip },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { id: 'v_arr', label: 'Arrangement View', action: () => handlers.onSelectWorkspace?.('arrangement') },
        { id: 'v_piano', label: 'Piano Roll View', action: () => handlers.onSelectWorkspace?.('pianoroll') },
        { id: 'v_seq', label: 'Step Sequencer / Beat Matrix', action: () => handlers.onSelectWorkspace?.('stepsequencer') },
        { id: 'v_mix', label: 'Mixer Console View', action: () => handlers.onSelectWorkspace?.('mixer') },
        { id: 'sep_v1', label: '', separator: true, action: () => {} },
        { id: 't_browser', label: 'Toggle Sample Browser', shortcut: 'B', action: handlers.onToggleBrowser },
        { id: 't_inspector', label: 'Toggle Inspector Panel', shortcut: 'I', action: handlers.onToggleInspector },
        { id: 't_mixer', label: 'Toggle Mixer Console Panel', shortcut: 'M', action: handlers.onToggleMixer },
      ],
    },
    {
      id: 'track',
      label: 'Track',
      items: [
        { id: 'add_audio', label: 'Add Audio Track', shortcut: 'Ctrl+T', action: handlers.onAddAudioTrack },
        { id: 'add_midi', label: 'Add MIDI Track', shortcut: 'Ctrl+Shift+T', action: handlers.onAddMidiTrack },
        { id: 'add_inst', label: 'Add Instrument Track (Synth / 808)', action: handlers.onAddInstrumentTrack },
        { id: 'add_drum', label: 'Add Drum Sequencer Track', action: () => (handlers.onAddDrumTrack ? handlers.onAddDrumTrack() : handlers.onAddAudioTrack()) },
        { id: 'sep_t1', label: '', separator: true, action: () => {} },
        { id: 'del_track', label: 'Delete Selected Track', action: handlers.onDeleteSelectedTrack },
      ],
    },
    {
      id: 'mixer',
      label: 'Mixer',
      items: [
        { id: 'show_mix', label: 'Open Mixing Console', action: handlers.onToggleMixer },
        { id: 'exp_mix_stems', label: 'Export Stems as Multitrack WAV', action: handlers.onExportStems },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'shortcuts', label: 'Keyboard Shortcuts Reference', shortcut: '?', action: handlers.onShowShortcuts },
        { id: 'audio_setup', label: 'Web Audio Engine Status & Settings', action: handlers.onShowAudioSetup },
      ],
    },
  ];

  return (
    <nav
      ref={barRef}
      style={{
        height: '28px',
        backgroundColor: '#17191E',
        borderBottom: '1px solid #1D2027',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        userSelect: 'none',
        position: 'relative',
        zIndex: 900,
        flexShrink: 0,
      }}
    >
      {MENUS.map((menu) => {
        const isOpen = openMenu === menu.id;

        return (
          <div key={menu.id} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(isOpen ? null : menu.id)}
              onMouseEnter={() => {
                if (openMenu !== null) setOpenMenu(menu.id);
              }}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: isOpen ? '#FFFFFF' : '#9CA3AF',
                backgroundColor: isOpen ? '#252932' : 'transparent',
                borderRadius: '3px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {menu.label}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '26px',
                  left: 0,
                  minWidth: '220px',
                  backgroundColor: '#1D2027',
                  border: '1px solid #252932',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  zIndex: 999,
                }}
              >
                {menu.items.map((item) => {
                  if (item.separator) {
                    return (
                      <div
                        key={item.id}
                        style={{ height: '1px', backgroundColor: '#252932', margin: '3px 0' }}
                      />
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenMenu(null);
                        item.action();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: item.disabled ? '#697180' : '#F3F4F6',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: item.disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        if (!item.disabled) e.currentTarget.style.backgroundColor = '#252932';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span style={{ fontSize: '10px', color: '#697180', fontFamily: 'monospace' }}>
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
};

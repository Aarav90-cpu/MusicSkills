import React, { useState, useEffect, useRef } from 'react';

export interface MenuActionHandlers {
  // File
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onSaveAsCopy: () => void;
  onImportAudio: () => void;
  onImportMidi: () => void;
  onExportMaster: () => void;
  onExportMidi: () => void;
  onExportStems: () => void;
  onOpenProjectSettings: () => void;
  onShowAudioSetup: () => void;
  onExit: () => void;

  // Edit
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoDesc: string;
  redoDesc: string;
  onCutClip: () => void;
  onCopyClip: () => void;
  onPasteClip: () => void;
  onDuplicateClip: () => void;
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onSplitClipAtPlayhead: () => void;
  onQuantizeClip: () => void;

  // View
  onSelectWorkspace?: (ws: 'arrangement' | 'pianoroll' | 'stepsequencer' | 'mixer') => void;
  onToggleBrowser: () => void;
  onToggleInspector: () => void;
  onToggleMixer: () => void;
  onToggleFullscreen: () => void;
  onResetWorkspace: () => void;

  // Track
  onAddAudioTrack: () => void;
  onAddMidiTrack: () => void;
  onAddInstrumentTrack: () => void;
  onAddDrumTrack?: () => void;
  onDuplicateSelectedTrack: () => void;
  onRenameSelectedTrack: () => void;
  onDeleteSelectedTrack: () => void;

  // Clip
  onReverseAudioClip?: () => void;
  onNormalizeAudioClip?: () => void;
  onToggleClipMute?: () => void;

  // Mixer
  onResetChannelLevels: () => void;
  onOpenMasterEffects: () => void;

  // Help
  onShowDoc: () => void;
  onShowShortcuts: () => void;
  onShowAbout: () => void;
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
        { id: 'open', label: 'Open Project / Library...', shortcut: 'Ctrl+O', action: handlers.onOpenProject },
        { id: 'save', label: 'Save Session', shortcut: 'Ctrl+S', action: handlers.onSaveProject },
        { id: 'save_copy', label: 'Save a Copy / Cover...', action: handlers.onSaveAsCopy },
        { id: 'sep_f1', label: '', separator: true, action: () => {} },
        { id: 'imp_aud', label: 'Import Audio File...', action: handlers.onImportAudio },
        { id: 'imp_mid', label: 'Import MIDI File...', action: handlers.onImportMidi },
        { id: 'sep_f2', label: '', separator: true, action: () => {} },
        { id: 'exp_wav', label: 'Export Audio Master (WAV)', shortcut: 'Ctrl+Shift+E', action: handlers.onExportMaster },
        { id: 'exp_mid', label: 'Export Project MIDI (.mid)', action: handlers.onExportMidi },
        { id: 'exp_stems', label: 'Export Track Stems (.zip)', action: handlers.onExportStems },
        { id: 'sep_f3', label: '', separator: true, action: () => {} },
        { id: 'proj_settings', label: 'Project Settings...', action: handlers.onOpenProjectSettings },
        { id: 'prefs', label: 'Audio Device Setup...', action: handlers.onShowAudioSetup },
        { id: 'exit', label: 'Exit to Main App', action: handlers.onExit },
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
          shortcut: 'Ctrl+Y',
          disabled: !handlers.canRedo,
          action: handlers.onRedo,
        },
        { id: 'sep_e1', label: '', separator: true, action: () => {} },
        { id: 'cut', label: 'Cut Clip', shortcut: 'Ctrl+X', action: handlers.onCutClip },
        { id: 'copy', label: 'Copy Clip', shortcut: 'Ctrl+C', action: handlers.onCopyClip },
        { id: 'paste', label: 'Paste Clip at Playhead', shortcut: 'Ctrl+V', action: handlers.onPasteClip },
        { id: 'dup', label: 'Duplicate Selected Clip', shortcut: 'Ctrl+D', action: handlers.onDuplicateClip },
        { id: 'del', label: 'Delete Selected', shortcut: 'Del', action: handlers.onDeleteSelected },
        { id: 'sep_e2', label: '', separator: true, action: () => {} },
        { id: 'sel_all', label: 'Select All', shortcut: 'Ctrl+A', action: handlers.onSelectAll },
        { id: 'desel', label: 'Deselect', shortcut: 'Esc', action: handlers.onDeselect },
        { id: 'sep_e3', label: '', separator: true, action: () => {} },
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
        { id: 'sep_v2', label: '', separator: true, action: () => {} },
        { id: 'full_screen', label: 'Toggle Full Screen', shortcut: 'F11', action: handlers.onToggleFullscreen },
        { id: 'reset_ws', label: 'Reset Workspace Layout', action: handlers.onResetWorkspace },
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
        { id: 'dup_track', label: 'Duplicate Selected Track', action: handlers.onDuplicateSelectedTrack },
        { id: 'ren_track', label: 'Rename Selected Track...', action: handlers.onRenameSelectedTrack },
        { id: 'del_track', label: 'Delete Selected Track', action: handlers.onDeleteSelectedTrack },
      ],
    },
    {
      id: 'clip',
      label: 'Clip',
      items: [
        { id: 'c_split', label: 'Split at Playhead', shortcut: 'S', action: handlers.onSplitClipAtPlayhead },
        { id: 'c_dup', label: 'Duplicate Clip', shortcut: 'Ctrl+D', action: handlers.onDuplicateClip },
        { id: 'c_quant', label: 'Quantize MIDI Notes', shortcut: 'Q', action: handlers.onQuantizeClip },
        { id: 'sep_c1', label: '', separator: true, action: () => {} },
        { id: 'c_rev', label: 'Reverse Audio Buffer', action: () => handlers.onReverseAudioClip?.() },
        { id: 'c_norm', label: 'Normalize Audio (0 dBFS)', action: () => handlers.onNormalizeAudioClip?.() },
        { id: 'c_mute', label: 'Toggle Clip Mute', action: () => handlers.onToggleClipMute?.() },
        { id: 'sep_c2', label: '', separator: true, action: () => {} },
        { id: 'c_del', label: 'Delete Clip', shortcut: 'Del', action: handlers.onDeleteSelected },
      ],
    },
    {
      id: 'mixer',
      label: 'Mixer',
      items: [
        { id: 'show_mix', label: 'Open Mixing Console', action: handlers.onToggleMixer },
        { id: 'reset_lev', label: 'Reset Channel Levels (0 dB)', action: handlers.onResetChannelLevels },
        { id: 'master_fx', label: 'Master Bus FX Rack...', action: handlers.onOpenMasterEffects },
        { id: 'sep_m1', label: '', separator: true, action: () => {} },
        { id: 'exp_mix_stems', label: 'Export Stems as Multitrack WAV', action: handlers.onExportStems },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'doc', label: 'Studio Manual & Reference Guide', shortcut: 'F1', action: handlers.onShowDoc },
        { id: 'shortcuts', label: 'Keyboard Shortcuts Reference', shortcut: '?', action: handlers.onShowShortcuts },
        { id: 'audio_setup', label: 'Web Audio Engine Status & Settings', action: handlers.onShowAudioSetup },
        { id: 'sep_h1', label: '', separator: true, action: () => {} },
        { id: 'about', label: 'About MusicSkills DAW', action: handlers.onShowAbout },
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
                  minWidth: '230px',
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

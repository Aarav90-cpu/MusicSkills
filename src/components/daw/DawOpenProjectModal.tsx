/**
 * MusicSkills Professional DAW - Project Library & Session Manager Modal
 * Browse saved projects, launch genre templates, import/export session files.
 * Strictly zero-emoji.
 */

import React, { useState, useEffect } from 'react';
import {
  DawProject,
  ProjectSummary,
  listLibraryProjects,
  loadProjectFromLibrary,
  deleteProjectFromLibrary,
  createTemplateProject,
  exportProjectAsJson,
  importProjectFromJson,
} from '../../utils/daw/projectModel';
import { DawConfirmModal } from './DawConfirmModal';

interface DawOpenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: DawProject;
  onLoadProject: (project: DawProject) => void;
  onShowSnackbar: (msg: string) => void;
}

export const DawOpenProjectModal: React.FC<DawOpenProjectModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  onLoadProject,
  onShowSnackbar,
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'templates' | 'import_export'>('saved');
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSavedProjects(listLibraryProjects());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenSaved = (id: string) => {
    const proj = loadProjectFromLibrary(id);
    if (proj) {
      onLoadProject(proj);
      onShowSnackbar(`Loaded project "${proj.name}"!`);
      onClose();
    } else {
      onShowSnackbar('Could not load project session.');
    }
  };

  const handleDeleteSaved = (id: string, name: string) => {
    setDeleteConfirmTarget({ id, name });
  };

  const executeDeleteSaved = () => {
    if (!deleteConfirmTarget) return;
    deleteProjectFromLibrary(deleteConfirmTarget.id);
    setSavedProjects(listLibraryProjects());
    onShowSnackbar(`Removed "${deleteConfirmTarget.name}" from library.`);
    setDeleteConfirmTarget(null);
  };

  const handleLoadTemplate = (template: 'blank' | 'trap' | 'house' | 'lofi' | 'synthwave') => {
    const proj = createTemplateProject(template);
    onLoadProject(proj);
    onShowSnackbar(`Created new project from ${template.toUpperCase()} template!`);
    onClose();
  };

  const handleExportCurrent = () => {
    const json = exportProjectAsJson(currentProject);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name.replace(/\s+/g, '_')}.musicskills.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowSnackbar(`Exported session file "${a.download}"!`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importProjectFromJson(text);
        onLoadProject(imported);
        onShowSnackbar(`Successfully imported session "${imported.name}"!`);
        onClose();
      } catch (err: any) {
        onShowSnackbar(`Import error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const TEMPLATES: Array<{
    id: 'blank' | 'trap' | 'house' | 'lofi' | 'synthwave';
    name: string;
    bpm: number;
    key: string;
    description: string;
    tags: string[];
  }> = [
    {
      id: 'trap',
      name: 'Midnight Trap & 808s',
      bpm: 140,
      key: 'F Minor',
      description: 'Hard-hitting 808 sub bass, dark minor piano chord progression, rolling hi-hats, and punchy trap snare.',
      tags: ['Trap', '808', 'Dark', 'Hip-Hop'],
    },
    {
      id: 'house',
      name: 'Club House Groove',
      bpm: 126,
      key: 'A Minor',
      description: 'Classic 4/4 dance groove with syncopated offbeat bass, driving chord stabs, and melodic synth pluck.',
      tags: ['EDM', 'Deep House', 'Club', 'Dance'],
    },
    {
      id: 'lofi',
      name: 'Late Night Lo-Fi Chill',
      bpm: 85,
      key: 'C# Minor',
      description: 'Warm electric Rhodes piano chords, mellow jazz voicings, acoustic bassline, and vintage study vibes.',
      tags: ['Lo-Fi', 'Rhodes', 'Chill', 'Jazz'],
    },
    {
      id: 'synthwave',
      name: 'Neon Outrun & Synthwave',
      bpm: 112,
      key: 'D Minor',
      description: '16th note synth arpeggios, pulsing retro bass, driving drums, and 80s futuristic soundtrack atmosphere.',
      tags: ['Synthwave', 'Retro', 'Cyberpunk', 'Arp'],
    },
    {
      id: 'blank',
      name: 'Blank Studio Session',
      bpm: 120,
      key: 'C Minor',
      description: 'Clean canvas initialized with 5 balanced channel strips ready for custom arrangement and sound design.',
      tags: ['Init', 'Default', 'Clean'],
    },
  ];

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
          width: '760px',
          maxHeight: '85vh',
          backgroundColor: '#17191E',
          border: '1px solid #2D3139',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1D2027',
            borderBottom: '1px solid #252932',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#F3F4F6' }}>
              Project Library & Session Manager
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#9CA3AF' }}>
              Current Session: <span style={{ color: '#8B78FF' }}>{currentProject.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            x
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#14161B',
            borderBottom: '1px solid #252932',
            padding: '0 16px',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setActiveTab('saved')}
            style={{
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'saved' ? '2px solid #8B78FF' : '2px solid transparent',
              color: activeTab === 'saved' ? '#F3F4F6' : '#9CA3AF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Saved Sessions ({savedProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'templates' ? '2px solid #8B78FF' : '2px solid transparent',
              color: activeTab === 'templates' ? '#F3F4F6' : '#9CA3AF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Studio Templates ({TEMPLATES.length})
          </button>
          <button
            onClick={() => setActiveTab('import_export')}
            style={{
              padding: '10px 14px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'import_export' ? '2px solid #8B78FF' : '2px solid transparent',
              color: activeTab === 'import_export' ? '#F3F4F6' : '#9CA3AF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Import / Export File
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', minHeight: '360px' }}>
          {/* TAB 1: SAVED SESSIONS */}
          {activeTab === 'saved' && (
            <div>
              {savedProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#697180' }}>
                  <p style={{ fontSize: '13px', margin: '0 0 8px' }}>No saved projects in local library yet.</p>
                  <p style={{ fontSize: '11px', margin: 0 }}>
                    Click &quot;File &gt; Save Session&quot; in the menu bar to store your work in the studio library.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedProjects.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: '#1F232C',
                        border: '1px solid #2D3139',
                        borderRadius: '6px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#F3F4F6', marginBottom: '4px' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF', display: 'flex', gap: '12px' }}>
                          <span>{p.bpm} BPM</span>
                          <span>Key: {p.key} {p.scale}</span>
                          <span>{p.tracksCount} Tracks</span>
                          <span>{p.clipsCount} Clips</span>
                          <span>Modified: {new Date(p.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleOpenSaved(p.id)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#8B78FF',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Open Session
                        </button>
                        <button
                          onClick={() => handleDeleteSaved(p.id, p.name)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: 'transparent',
                            border: '1px solid #FF5252',
                            borderRadius: '4px',
                            color: '#FF5252',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEMPLATES */}
          {activeTab === 'templates' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  style={{
                    backgroundColor: '#1F232C',
                    border: '1px solid #2D3139',
                    borderRadius: '6px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#F3F4F6' }}>{tmpl.name}</span>
                      <span style={{ fontSize: '10px', color: '#35C9A5', fontFamily: 'monospace' }}>
                        {tmpl.bpm} BPM | {tmpl.key}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 10px', lineHeight: 1.4 }}>
                      {tmpl.description}
                    </p>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {tmpl.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '9px',
                            backgroundColor: '#2A2E37',
                            color: '#CBD5E1',
                            padding: '2px 6px',
                            borderRadius: '3px',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoadTemplate(tmpl.id)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#2A2E37',
                      border: '1px solid #3F4452',
                      borderRadius: '4px',
                      color: '#F3F4F6',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#8B78FF')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2A2E37')}
                  >
                    Load Template
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: IMPORT / EXPORT */}
          {activeTab === 'import_export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px', margin: '0 auto' }}>
              <div
                style={{
                  backgroundColor: '#1F232C',
                  border: '1px solid #2D3139',
                  borderRadius: '6px',
                  padding: '16px',
                }}
              >
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#F3F4F6' }}>
                  Export Current Project File (.musicskills.json)
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#9CA3AF', lineHeight: 1.4 }}>
                  Save a standalone JSON project backup to your local computer. Contains all tracks, clips, MIDI notes, FX chains, mixer volume, and BPM settings.
                </p>
                <button
                  onClick={handleExportCurrent}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#8B78FF',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Download Project Session (.json)
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#1F232C',
                  border: '1px solid #2D3139',
                  borderRadius: '6px',
                  padding: '16px',
                }}
              >
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#F3F4F6' }}>
                  Import Project File (.musicskills.json)
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#9CA3AF', lineHeight: 1.4 }}>
                  Load a previously exported .musicskills.json session file from your local hard drive into the workspace.
                </p>
                <input
                  type="file"
                  accept=".json,.musicskills.json"
                  onChange={handleImportFile}
                  style={{
                    fontSize: '11px',
                    color: '#9CA3AF',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#14161B',
            borderTop: '1px solid #252932',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              backgroundColor: '#2A2E37',
              border: 'none',
              borderRadius: '4px',
              color: '#F3F4F6',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      <DawConfirmModal
        isOpen={Boolean(deleteConfirmTarget)}
        onClose={() => setDeleteConfirmTarget(null)}
        title="Delete Saved Project"
        message={`Permanently remove "${deleteConfirmTarget?.name}" from your local project library? This cannot be undone.`}
        confirmLabel="Delete Project"
        isDestructive={true}
        onConfirm={executeDeleteSaved}
      />
    </div>
  );
};


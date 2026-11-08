/**
 * MusicSkills Professional DAW - Project Model, State Architecture & Undo/Redo Engine
 * Strongly-typed session state, track & clip hierarchy, autosave recovery, and command history.
 * Strictly zero-emoji.
 */

import { ChannelEffectsConfig, DEFAULT_EFFECTS_CONFIG } from './effectsRack';

export type EditingTool = 'pointer' | 'split' | 'draw' | 'erase' | 'mute';
export type TrackType = 'audio' | 'midi' | 'instrument' | 'bus';

export interface DawNote {
  id: string;
  pitch: string;       // e.g. "C4", "G#3"
  step: number;        // 0 to 31 within pattern / clip
  durationSteps: number; // 1 to 32 (sixteenth notes)
  velocity: number;    // 0.0 to 1.0
}

export interface DawClip {
  id: string;
  trackId: string;
  name: string;
  type: 'audio' | 'midi';
  startBar: number;     // 1-based bar number
  durationBars: number; // Duration in musical bars
  color?: string;
  isMuted?: boolean;

  // Audio Clip Properties
  sampleId?: string;
  audioBuffer?: AudioBuffer;
  peaks?: number[];
  gainLinear?: number;
  volumeOffsetDb?: number;
  pitchShiftSemitones?: number;
  isReversed?: boolean;

  // MIDI Clip Properties
  notes?: DawNote[];
}

export interface DawTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volumeDb: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
  isArmed: boolean;
  instrumentPreset?: string;
  effects: ChannelEffectsConfig;
}

export interface DawProject {
  id: string;
  name: string;
  bpm: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  key: string;
  scale: string;
  snapResolution: string; // '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | 'free'
  totalBars: number;
  tracks: DawTrack[];
  clips: DawClip[];
  loopStartBar: number;
  loopEndBar: number;
  isLoopEnabled: boolean;
  masterVolumeDb: number;
  masterEffects: ChannelEffectsConfig;
  createdAt: string;
  updatedAt: string;
}

export interface UndoableAction {
  description: string;
  undo: () => void;
  redo: () => void;
}

export class HistoryManager {
  private undoStack: UndoableAction[] = [];
  private redoStack: UndoableAction[] = [];
  private maxHistory = 40;

  public pushAction(action: UndoableAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  public undo(): boolean {
    const action = this.undoStack.pop();
    if (!action) return false;
    action.undo();
    this.redoStack.push(action);
    return true;
  }

  public redo(): boolean {
    const action = this.redoStack.pop();
    if (!action) return false;
    action.redo();
    this.undoStack.push(action);
    return true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoDescription(): string {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].description : '';
  }

  public getRedoDescription(): string {
    return this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].description : '';
  }
}

export function createDefaultProject(id = 'proj_' + Math.random().toString(36).substring(2, 8), name = 'Untitled DAW Session'): DawProject {
  const tracks: DawTrack[] = [
    {
      id: 'trk_drums',
      name: 'Drums & Beats',
      type: 'audio',
      color: '#FF5252',
      volumeDb: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS_CONFIG)),
    },
    {
      id: 'trk_bass',
      name: '808 & Bassline',
      type: 'instrument',
      color: '#8B78FF',
      volumeDb: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrumentPreset: 'bass',
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS_CONFIG)),
    },
    {
      id: 'trk_keys',
      name: 'Piano & Keys',
      type: 'midi',
      color: '#35C9A5',
      volumeDb: -2,
      pan: -0.15,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrumentPreset: 'piano',
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS_CONFIG)),
    },
    {
      id: 'trk_lead',
      name: 'Lead Synth',
      type: 'midi',
      color: '#E9A45B',
      volumeDb: -3,
      pan: 0.15,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrumentPreset: 'synth',
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS_CONFIG)),
    },
    {
      id: 'trk_vox',
      name: 'Audio & Vocals',
      type: 'audio',
      color: '#F5C451',
      volumeDb: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: true,
      effects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS_CONFIG)),
    },
  ];

  return {
    id,
    name,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    key: 'C',
    scale: 'minor',
    snapResolution: '1/16',
    totalBars: 16,
    tracks,
    clips: [],
    loopStartBar: 1,
    loopEndBar: 9,
    isLoopEnabled: false,
    masterVolumeDb: 0,
    masterEffects: JSON.parse(JSON.stringify(DEFAULT_EFFECTS_CONFIG)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const AUTOSAVE_STORAGE_KEY = 'musicskills_daw_autosave_snapshot';
export const PROJECTS_LIBRARY_STORAGE_KEY = 'musicskills_projects_library';

export interface ProjectSummary {
  id: string;
  name: string;
  bpm: number;
  tracksCount: number;
  clipsCount: number;
  updatedAt: string;
  key: string;
  scale: string;
}

export function saveAutosaveSnapshot(project: DawProject): void {
  try {
    // Avoid serializing large raw Float32Array AudioBuffers into localStorage
    const clone = {
      ...project,
      clips: project.clips.map((c) => ({
        ...c,
        audioBuffer: undefined, // AudioBuffer is restored from sampleId or cache
      })),
    };
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(clone));
  } catch (err) {
    console.warn('[DAW Autosave] Notice:', err);
  }
}

export function loadAutosaveSnapshot(): DawProject | null {
  try {
    const data = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

export function listLibraryProjects(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(PROJECTS_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const list: Record<string, DawProject> = JSON.parse(raw);
    return Object.values(list).map((p) => ({
      id: p.id,
      name: p.name,
      bpm: p.bpm,
      tracksCount: p.tracks?.length || 0,
      clipsCount: p.clips?.length || 0,
      updatedAt: p.updatedAt || p.createdAt,
      key: p.key,
      scale: p.scale,
    }));
  } catch (_) {
    return [];
  }
}

export function saveProjectToLibrary(project: DawProject): void {
  try {
    const raw = localStorage.getItem(PROJECTS_LIBRARY_STORAGE_KEY);
    const list: Record<string, any> = raw ? JSON.parse(raw) : {};
    const sanitized = {
      ...project,
      updatedAt: new Date().toISOString(),
      clips: project.clips.map((c) => ({
        ...c,
        audioBuffer: undefined,
      })),
    };
    list[project.id] = sanitized;
    localStorage.setItem(PROJECTS_LIBRARY_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('[DAW Library] Save failed:', err);
  }
}

export function loadProjectFromLibrary(projectId: string): DawProject | null {
  try {
    const raw = localStorage.getItem(PROJECTS_LIBRARY_STORAGE_KEY);
    if (!raw) return null;
    const list: Record<string, DawProject> = JSON.parse(raw);
    return list[projectId] || null;
  } catch (_) {
    return null;
  }
}

export function deleteProjectFromLibrary(projectId: string): void {
  try {
    const raw = localStorage.getItem(PROJECTS_LIBRARY_STORAGE_KEY);
    if (!raw) return;
    const list: Record<string, DawProject> = JSON.parse(raw);
    delete list[projectId];
    localStorage.setItem(PROJECTS_LIBRARY_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('[DAW Library] Delete failed:', err);
  }
}

export function exportProjectAsJson(project: DawProject): string {
  const sanitized = {
    ...project,
    clips: project.clips.map((c) => ({
      ...c,
      audioBuffer: undefined,
    })),
  };
  return JSON.stringify(sanitized, null, 2);
}

export function importProjectFromJson(jsonString: string): DawProject {
  const parsed = JSON.parse(jsonString);
  if (!parsed.id || !parsed.tracks || !Array.isArray(parsed.tracks)) {
    throw new Error('Invalid project file format: missing tracks or project metadata.');
  }
  return {
    ...parsed,
    id: `proj_${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };
}

export function createTemplateProject(template: 'blank' | 'trap' | 'house' | 'lofi' | 'synthwave'): DawProject {
  if (template === 'blank') {
    return createDefaultProject('proj_' + Date.now(), 'Blank Session');
  }

  if (template === 'trap') {
    const base = createDefaultProject('proj_' + Date.now(), 'Midnight Trap Session');
    base.bpm = 140;
    base.key = 'F';
    base.scale = 'minor';
    base.totalBars = 16;

    // Add dark trap chords on piano
    const pianoClip: DawClip = {
      id: `clip_trap_piano_${Date.now()}`,
      trackId: base.tracks[2].id, // Piano
      name: 'Dark Minor Chords',
      type: 'midi',
      startBar: 1,
      durationBars: 8,
      color: '#35C9A5',
      notes: [
        { id: 'tp1', pitch: 'F3', step: 0, durationSteps: 8, velocity: 0.8 },
        { id: 'tp2', pitch: 'Ab3', step: 0, durationSteps: 8, velocity: 0.75 },
        { id: 'tp3', pitch: 'C4', step: 0, durationSteps: 8, velocity: 0.85 },
        { id: 'tp4', pitch: 'Db3', step: 8, durationSteps: 8, velocity: 0.8 },
        { id: 'tp5', pitch: 'F3', step: 8, durationSteps: 8, velocity: 0.75 },
        { id: 'tp6', pitch: 'Ab3', step: 8, durationSteps: 8, velocity: 0.85 },
      ],
    };

    // Add 808 sub bassline
    const bassClip: DawClip = {
      id: `clip_trap_bass_${Date.now()}`,
      trackId: base.tracks[1].id, // 808 Bass
      name: '808 Sub Slide',
      type: 'midi',
      startBar: 1,
      durationBars: 8,
      color: '#8B78FF',
      notes: [
        { id: 'tb1', pitch: 'F1', step: 0, durationSteps: 6, velocity: 0.95 },
        { id: 'tb2', pitch: 'F1', step: 6, durationSteps: 2, velocity: 0.85 },
        { id: 'tb3', pitch: 'Db1', step: 8, durationSteps: 6, velocity: 0.95 },
        { id: 'tb4', pitch: 'Eb1', step: 14, durationSteps: 2, velocity: 0.9 },
      ],
    };

    base.clips = [pianoClip, bassClip];
    return base;
  }

  if (template === 'house') {
    const base = createDefaultProject('proj_' + Date.now(), 'Club Groove 126');
    base.bpm = 126;
    base.key = 'A';
    base.scale = 'minor';
    base.totalBars = 16;

    // Pluck synth progression
    const synthClip: DawClip = {
      id: `clip_house_synth_${Date.now()}`,
      trackId: base.tracks[3].id, // Lead synth
      name: 'Rolling House Pluck',
      type: 'midi',
      startBar: 1,
      durationBars: 8,
      color: '#E9A45B',
      notes: [
        { id: 'hs1', pitch: 'A3', step: 0, durationSteps: 2, velocity: 0.85 },
        { id: 'hs2', pitch: 'C4', step: 2, durationSteps: 2, velocity: 0.8 },
        { id: 'hs3', pitch: 'E4', step: 4, durationSteps: 2, velocity: 0.85 },
        { id: 'hs4', pitch: 'G4', step: 6, durationSteps: 2, velocity: 0.8 },
        { id: 'hs5', pitch: 'F4', step: 8, durationSteps: 2, velocity: 0.85 },
        { id: 'hs6', pitch: 'A4', step: 10, durationSteps: 2, velocity: 0.8 },
        { id: 'hs7', pitch: 'E4', step: 12, durationSteps: 2, velocity: 0.85 },
        { id: 'hs8', pitch: 'C4', step: 14, durationSteps: 2, velocity: 0.8 },
      ],
    };

    // Offbeat bassline
    const bassClip: DawClip = {
      id: `clip_house_bass_${Date.now()}`,
      trackId: base.tracks[1].id,
      name: 'Offbeat Bass',
      type: 'midi',
      startBar: 1,
      durationBars: 8,
      color: '#8B78FF',
      notes: [
        { id: 'hb1', pitch: 'A1', step: 2, durationSteps: 2, velocity: 0.9 },
        { id: 'hb2', pitch: 'A1', step: 6, durationSteps: 2, velocity: 0.9 },
        { id: 'hb3', pitch: 'A1', step: 10, durationSteps: 2, velocity: 0.9 },
        { id: 'hb4', pitch: 'A1', step: 14, durationSteps: 2, velocity: 0.9 },
      ],
    };

    base.clips = [synthClip, bassClip];
    return base;
  }

  if (template === 'lofi') {
    const base = createDefaultProject('proj_' + Date.now(), 'Late Night Lo-Fi');
    base.bpm = 85;
    base.key = 'C#';
    base.scale = 'minor';
    base.totalBars = 16;

    const rhodesClip: DawClip = {
      id: `clip_lofi_rhodes_${Date.now()}`,
      trackId: base.tracks[2].id,
      name: 'Dusty Rhodes Chords',
      type: 'midi',
      startBar: 1,
      durationBars: 8,
      color: '#35C9A5',
      notes: [
        { id: 'lr1', pitch: 'C#3', step: 0, durationSteps: 7, velocity: 0.7 },
        { id: 'lr2', pitch: 'E3', step: 0, durationSteps: 7, velocity: 0.65 },
        { id: 'lr3', pitch: 'G#3', step: 0, durationSteps: 7, velocity: 0.7 },
        { id: 'lr4', pitch: 'B3', step: 0, durationSteps: 7, velocity: 0.65 },
        { id: 'lr5', pitch: 'A2', step: 8, durationSteps: 7, velocity: 0.7 },
        { id: 'lr6', pitch: 'C#3', step: 8, durationSteps: 7, velocity: 0.65 },
        { id: 'lr7', pitch: 'E3', step: 8, durationSteps: 7, velocity: 0.7 },
        { id: 'lr8', pitch: 'G#3', step: 8, durationSteps: 7, velocity: 0.65 },
      ],
    };

    base.clips = [rhodesClip];
    return base;
  }

  // Synthwave
  const base = createDefaultProject('proj_' + Date.now(), 'Neon Outrun');
  base.bpm = 112;
  base.key = 'D';
  base.scale = 'minor';
  base.totalBars = 16;

  const arpeggioClip: DawClip = {
    id: `clip_synthwave_arp_${Date.now()}`,
    trackId: base.tracks[3].id,
    name: '16th Note Arpeggio',
    type: 'midi',
    startBar: 1,
    durationBars: 8,
    color: '#E9A45B',
    notes: [
      { id: 'sw1', pitch: 'D3', step: 0, durationSteps: 1, velocity: 0.8 },
      { id: 'sw2', pitch: 'F3', step: 2, durationSteps: 1, velocity: 0.8 },
      { id: 'sw3', pitch: 'A3', step: 4, durationSteps: 1, velocity: 0.85 },
      { id: 'sw4', pitch: 'D4', step: 6, durationSteps: 1, velocity: 0.9 },
      { id: 'sw5', pitch: 'C4', step: 8, durationSteps: 1, velocity: 0.85 },
      { id: 'sw6', pitch: 'A3', step: 10, durationSteps: 1, velocity: 0.8 },
      { id: 'sw7', pitch: 'F3', step: 12, durationSteps: 1, velocity: 0.8 },
      { id: 'sw8', pitch: 'E3', step: 14, durationSteps: 1, velocity: 0.8 },
    ],
  };

  base.clips = [arpeggioClip];
  return base;
}



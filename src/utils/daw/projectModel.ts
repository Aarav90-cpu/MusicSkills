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

export interface SongStyle {
  topic: string;
  description: string;
  genre: string;
  subgenre: string;
  moods: string[];
  purposes: string[];
  instrumentation: string[];
  vocalDelivery: string;
  bpm: number;
  key: string;
  scale: string;
  identityLine: string;
}

export interface SongSection {
  name: string;
  type: string;
  bars: number;
  energy: string;
}

export interface SongVersion {
  version: string;
  createdAt: string;
  bpm: number;
  key: string;
  midiFile: string;
  mp3File: string;
  leadSheetFile: string;
  durationSec: number;
  notes?: string;
}

export interface VocalTake {
  id: string;
  section: string;
  filename: string;
  createdAt: string;
  durationSec: number;
  isFavorite: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  name: string;
  folderName: string;
  createdAt: string;
  updatedAt: string;
  step: 'style' | 'lyrics' | 'review' | 'generate' | 'result';
  style: SongStyle;
  lyrics: Record<string, string[]>;
  sections: SongSection[];
  versions: SongVersion[];
  messages: ChatMessage[];
  takes: VocalTake[];
  coverArtUrl?: string;
  studioArrangement?: StudioArrangement;
  copiedFrom?: string;
  coverOf?: string;
}

export interface StudioNote {
  id: string;
  pitch: string; // e.g. "C4", "G#3"
  step: number; // 0 to 31 (1/16th notes within pattern)
  durationSteps: number; // 1, 2, 4, 8...
  velocity?: number; // 0 to 1
}

export interface StudioPattern {
  id: string;
  name: string;
  type: 'drums' | 'notes';
  instrument: string; // 'kick', 'snare', 'hihat', 'piano', 'bass', 'synth', etc.
  steps?: boolean[]; // for step sequencer (e.g. 16 or 32 steps)
  notes?: StudioNote[]; // for piano roll
}

export interface StudioClip {
  id: string;
  trackId: string;
  patternId?: string;
  name: string;
  startBar: number; // 1-based bar number (e.g. 1, 5, 9)
  durationBars: number; // e.g. 4 bars
  color?: string;
  audioUrl?: string; // for uploaded audio clips
  audioFileName?: string;
  audioDurationSec?: number;
}

export interface StudioTrack {
  id: string;
  name: string;
  type: 'drums' | 'bass' | 'piano' | 'synth' | 'audio';
  instrument: string;
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  isMuted: boolean;
  isSolo: boolean;
  color: string;
}

export interface StudioArrangement {
  bpm: number;
  key: string;
  scale: string;
  timeSignature: string;
  totalBars: number;
  tracks: StudioTrack[];
  clips: StudioClip[];
  patterns: Record<string, StudioPattern>;
  copiedFrom?: string;
  coverOf?: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  stage: string;
  status: 'running' | 'done' | 'error';
  durationMs?: number;
  details?: string;
}

export interface PlayerTrack {
  chatId: string;
  songName: string;
  artist?: string;
  album?: string;
  coverArtUrl?: string;
  syncedLyrics?: string;
  version: string;
  mp3Url: string;
  midiUrl: string;
  durationSec: number;
  lyrics: Record<string, string[]>;
  bpm: number;
}


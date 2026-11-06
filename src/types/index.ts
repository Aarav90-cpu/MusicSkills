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
  version: string;
  mp3Url: string;
  midiUrl: string;
  durationSec: number;
  lyrics: Record<string, string[]>;
  bpm: number;
}

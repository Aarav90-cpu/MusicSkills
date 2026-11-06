/**
 * MusicSkills Studio - Library & Player Storage Utility
 * Manages user playlists, albums, favorite tracks, and listening/coding analytics.
 * Strictly zero-emoji.
 */

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioStats {
  listeningSeconds: number;
  codingSeconds: number;
  songsCreated: number;
  promptTokens: number;
  completionTokens: number;
  favoriteTrackIds: string[];
  genrePlays: Record<string, number>;
}

const STATS_STORAGE_KEY = 'musicskills_studio_stats_v1';
const PLAYLISTS_STORAGE_KEY = 'musicskills_studio_playlists_v1';

const DEFAULT_STATS: StudioStats = {
  listeningSeconds: 1240, // realistic initial start
  codingSeconds: 3820,
  songsCreated: 3,
  promptTokens: 18450,
  completionTokens: 6240,
  favoriteTrackIds: [],
  genrePlays: {
    pop: 4,
    rock: 2,
    phonk: 6,
    electronic: 3,
  },
};

export function loadStudioStats(): StudioStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_STATS };
}

export function saveStudioStats(stats: StudioStats): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (_) {}
}

export function incrementListeningTime(seconds: number = 1): void {
  const current = loadStudioStats();
  current.listeningSeconds += seconds;
  saveStudioStats(current);
}

export function incrementCodingTime(seconds: number = 1): void {
  const current = loadStudioStats();
  current.codingSeconds += seconds;
  saveStudioStats(current);
}

export function addTokenUsage(promptTokens: number, completionTokens: number): void {
  const current = loadStudioStats();
  current.promptTokens += promptTokens;
  current.completionTokens += completionTokens;
  saveStudioStats(current);
}

export function toggleFavoriteTrack(chatId: string): boolean {
  const current = loadStudioStats();
  const exists = current.favoriteTrackIds.includes(chatId);
  if (exists) {
    current.favoriteTrackIds = current.favoriteTrackIds.filter(id => id !== chatId);
  } else {
    current.favoriteTrackIds.push(chatId);
  }
  saveStudioStats(current);
  return !exists;
}

export function isTrackFavorite(chatId: string): boolean {
  const current = loadStudioStats();
  return current.favoriteTrackIds.includes(chatId);
}

export function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Playlist[];
  } catch (_) {}
  return [
    {
      id: 'pl-heavy-rotation',
      name: 'Heavy Studio Rotation',
      description: 'Top master tracks and high-energy workout songs',
      trackIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'pl-acoustic-chill',
      name: 'Acoustic & Storytelling',
      description: 'Intimate melodies and lyrical storytelling',
      trackIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function savePlaylists(playlists: Playlist[]): void {
  try {
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists));
  } catch (_) {}
}

export function createPlaylist(name: string, description: string = ''): Playlist {
  const playlists = loadPlaylists();
  const now = new Date().toISOString();
  const newPl: Playlist = {
    id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim() || 'New Playlist',
    description,
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
  playlists.push(newPl);
  savePlaylists(playlists);
  return newPl;
}

export function addTrackToPlaylist(playlistId: string, trackId: string): void {
  const playlists = loadPlaylists();
  const pl = playlists.find(p => p.id === playlistId);
  if (pl && !pl.trackIds.includes(trackId)) {
    pl.trackIds.push(trackId);
    pl.updatedAt = new Date().toISOString();
    savePlaylists(playlists);
  }
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string): void {
  const playlists = loadPlaylists();
  const pl = playlists.find(p => p.id === playlistId);
  if (pl) {
    pl.trackIds = pl.trackIds.filter(id => id !== trackId);
    pl.updatedAt = new Date().toISOString();
    savePlaylists(playlists);
  }
}

/**
 * MusicSkills Studio - Library & Player Storage Utility
 * Tracks genuine user listening sessions, coding time, AI token usage,
 * custom playlists, and favorite tracks without synthetic placeholders.
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

// Real zero-baseline statistics
const DEFAULT_STATS: StudioStats = {
  listeningSeconds: 0,
  codingSeconds: 0,
  songsCreated: 0,
  promptTokens: 0,
  completionTokens: 0,
  favoriteTrackIds: [],
  genrePlays: {},
};

export function loadStudioStats(): StudioStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATS, ...parsed };
    }
  } catch (_) {}
  return { ...DEFAULT_STATS };
}

export function saveStudioStats(stats: StudioStats): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (_) {}
}

export function incrementListeningTime(seconds: number = 1): void {
  if (seconds <= 0) return;
  const current = loadStudioStats();
  current.listeningSeconds += seconds;
  saveStudioStats(current);
}

export function incrementCodingTime(seconds: number = 1): void {
  if (seconds <= 0) return;
  const current = loadStudioStats();
  current.codingSeconds += seconds;
  saveStudioStats(current);
}

export function recordGenrePlay(genre: string): void {
  if (!genre) return;
  const cleanGenre = genre.trim().toLowerCase();
  const current = loadStudioStats();
  current.genrePlays[cleanGenre] = (current.genrePlays[cleanGenre] || 0) + 1;
  saveStudioStats(current);
}

export function addTokenUsage(promptTokens: number, completionTokens: number): void {
  const current = loadStudioStats();
  current.promptTokens += Math.max(0, promptTokens);
  current.completionTokens += Math.max(0, completionTokens);
  saveStudioStats(current);
}

export function toggleFavoriteTrack(trackId: string): boolean {
  const current = loadStudioStats();
  const exists = current.favoriteTrackIds.includes(trackId);
  if (exists) {
    current.favoriteTrackIds = current.favoriteTrackIds.filter(id => id !== trackId);
  } else {
    current.favoriteTrackIds.push(trackId);
  }
  saveStudioStats(current);
  return !exists;
}

export function isTrackFavorite(trackId: string): boolean {
  const current = loadStudioStats();
  return current.favoriteTrackIds.includes(trackId);
}

// Clean playlists: no placeholders, purely user-defined
export function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
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
    description: description.trim(),
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

export function deletePlaylist(playlistId: string): void {
  const playlists = loadPlaylists();
  const filtered = playlists.filter(p => p.id !== playlistId);
  savePlaylists(filtered);
}

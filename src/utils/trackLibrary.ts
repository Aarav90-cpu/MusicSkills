/**
 * MusicSkills Studio - Track Library & Smart Auto-Grouping Engine
 * Manages all music tracks (both studio-generated and folder-imported),
 * smart album/artist/genre auto-grouping, 4-tier lyrics resolution priority,
 * persistent lyrics caching, and full-spectrum metadata editing.
 * Strictly zero-emoji.
 */

import { searchFirstLyricsFromLRCLib, getLyricsFromLRCLib } from './lrclib';
import { parseAudioFileMetadata } from './id3Parser';

export interface CustomMetadataTag {
  key: string;
  value: string;
}

export type LyricsPrioritySource =
  | 'embedded_synced'
  | 'embedded_static'
  | 'local_synced'
  | 'online_synced'
  | 'offline_static'
  | 'online_static'
  | 'none';

export interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  genre: string;
  year?: string;
  composer?: string;
  producer?: string;
  bpm?: number;
  rootKey?: string;
  mood?: string;
  purpose?: string;
  durationSec: number;
  audioUrl: string;
  coverArtUrl?: string;
  dateAdded: string;
  fileSource: 'generated' | 'imported';
  fileName?: string;
  filePath?: string;
  fileSize?: number;

  // 6-Tier Lyrics Resolution Priority (Engraved lyrics in audio file have FIRST PRIORITY)
  embeddedSyncedLyrics?: string; // Priority 1: Engraved Synced in Audio File (USLT with timestamps or SYLT)
  embeddedStaticLyrics?: string; // Priority 2: Engraved Static in Audio File (USLT plain text)
  localSyncedLyrics?: string;    // Priority 3: Companion Local Synced (.lrc text)
  onlineSyncedLyrics?: string;   // Priority 4: Online Synced (from LRCLIB, cached)
  offlineStaticLyrics?: string;  // Priority 5: Companion Offline Static (plain text)
  onlineStaticLyrics?: string;   // Priority 6: Online Static (from LRCLIB, cached)

  lyricsSource: LyricsPrioritySource;
  lyricsCachedAt?: string;

  // Custom key-value tags & notes
  customTags: CustomMetadataTag[];
  notes?: string;
  isFavorite?: boolean;
}

export interface SmartAlbum {
  id: string;
  name: string;
  artist: string;
  tracks: LibraryTrack[];
  coverArtUrl?: string;
  totalDurationSec: number;
  year?: string;
  genre: string;
}

export interface SmartArtist {
  name: string;
  tracks: LibraryTrack[];
  albums: string[];
  totalDurationSec: number;
}

export interface SmartGenre {
  name: string;
  tracks: LibraryTrack[];
  totalDurationSec: number;
}

const TRACKS_STORAGE_KEY = 'musicskills_library_tracks_v2';
const LYRICS_CACHE_KEY = 'musicskills_lyrics_cache_v1';

// In-memory active blob and file cache to ensure instant playback without network delays
const liveBlobMap = new Map<string, string>();
const liveFileMap = new Map<string, File>();

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export function getLiveAudioUrl(trackId: string): string | null {
  return liveBlobMap.get(trackId) || null;
}

export function registerLiveTrackAudio(trackId: string, file: File): string {
  const url = URL.createObjectURL(file);
  liveBlobMap.set(trackId, url);
  liveFileMap.set(trackId, file);
  return url;
}

// --- PERSISTENT STORAGE ---

export function loadLibraryTracks(): LibraryTrack[] {
  try {
    const raw = localStorage.getItem(TRACKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((t: LibraryTrack) => {
          // Check if active in-memory blob is available
          if (liveBlobMap.has(t.id)) {
            t.audioUrl = liveBlobMap.get(t.id)!;
          } else if (t.audioUrl && t.audioUrl.startsWith('blob:')) {
            // Dead blob URL - convert to permanent server audio route with title fallback
            t.audioUrl = `/api/audio/${t.id}/v1_custom.mp3?title=${encodeURIComponent(t.title)}`;
          }

          // If coverArtUrl is missing or an expired blob URL, convert to permanent server cover route
          if (!t.coverArtUrl || t.coverArtUrl.startsWith('blob:')) {
            t.coverArtUrl = `/api/audio/${t.id}/cover?title=${encodeURIComponent(t.title)}`;
          }

          return t;
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load library tracks from localStorage:', e);
  }
  return [];
}

export function saveLibraryTracks(tracks: LibraryTrack[]): void {
  try {
    localStorage.setItem(TRACKS_STORAGE_KEY, JSON.stringify(tracks));
  } catch (e) {
    console.warn('Failed to save library tracks to localStorage:', e);
  }
}

// --- LYRICS CACHE MANAGEMENT ---

interface LyricsCacheItem {
  trackName: string;
  artistName: string;
  syncedLyrics?: string;
  plainLyrics?: string;
  cachedAt: string;
}

function getLyricsCache(): Record<string, LyricsCacheItem> {
  try {
    const raw = localStorage.getItem(LYRICS_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

function saveLyricsCache(cache: Record<string, LyricsCacheItem>): void {
  try {
    localStorage.setItem(LYRICS_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {}
}

export function getCachedLyrics(trackName: string, artistName: string): LyricsCacheItem | null {
  const cache = getLyricsCache();
  const key = `${trackName.trim().toLowerCase()}:::${artistName.trim().toLowerCase()}`;
  return cache[key] || null;
}

export function setCachedLyrics(trackName: string, artistName: string, syncedLyrics?: string, plainLyrics?: string): void {
  const cache = getLyricsCache();
  const key = `${trackName.trim().toLowerCase()}:::${artistName.trim().toLowerCase()}`;
  cache[key] = {
    trackName,
    artistName,
    syncedLyrics,
    plainLyrics,
    cachedAt: new Date().toISOString(),
  };
  saveLyricsCache(cache);
}

// --- 6-TIER LYRICS RESOLUTION PRIORITY ---
// 1st Priority: Engraved Synced Lyrics in Audio File itself (USLT with [mm:ss.xx] timestamps or SYLT)
// 2nd Priority: Engraved Static Lyrics in Audio File itself (USLT plain text)
// 3rd Priority: Local Companion Synced (.lrc file with [mm:ss.xx])
// 4th Priority: Online Synced (LRCLIB synced lyrics, cached locally)
// 5th Priority: Local Companion Static (.txt plain text file)
// 6th Priority: Online Static (LRCLIB plain lyrics, cached locally)

export function resolveTrackLyrics(track: LibraryTrack): {
  type: 'synced' | 'plain' | 'none';
  content: string;
  source: LyricsPrioritySource;
  label: string;
} {
  // Priority 1: Engraved Synced Lyrics in audio file
  if (track.embeddedSyncedLyrics && track.embeddedSyncedLyrics.trim().length > 0) {
    return {
      type: 'synced',
      content: track.embeddedSyncedLyrics.trim(),
      source: 'embedded_synced',
      label: 'Priority 1: Engraved Synced (In Audio File)',
    };
  }

  // Priority 2: Engraved Static Lyrics in audio file
  if (track.embeddedStaticLyrics && track.embeddedStaticLyrics.trim().length > 0) {
    return {
      type: 'plain',
      content: track.embeddedStaticLyrics.trim(),
      source: 'embedded_static',
      label: 'Priority 1: Engraved Lyrics (In Audio File)',
    };
  }

  // Priority 3: Local Companion Synced (.lrc text)
  if (track.localSyncedLyrics && track.localSyncedLyrics.trim().length > 0) {
    return {
      type: 'synced',
      content: track.localSyncedLyrics.trim(),
      source: 'local_synced',
      label: 'Priority 2: Local Companion .lrc Synced',
    };
  }

  // Priority 4: Online Synced (cached)
  if (track.onlineSyncedLyrics && track.onlineSyncedLyrics.trim().length > 0) {
    return {
      type: 'synced',
      content: track.onlineSyncedLyrics.trim(),
      source: 'online_synced',
      label: 'Priority 3: Online Synced (Cached)',
    };
  }

  // Priority 5: Local Companion Static (.txt file)
  if (track.offlineStaticLyrics && track.offlineStaticLyrics.trim().length > 0) {
    return {
      type: 'plain',
      content: track.offlineStaticLyrics.trim(),
      source: 'offline_static',
      label: 'Priority 4: Local Companion .txt Static',
    };
  }

  // Priority 6: Online Static (cached)
  if (track.onlineStaticLyrics && track.onlineStaticLyrics.trim().length > 0) {
    return {
      type: 'plain',
      content: track.onlineStaticLyrics.trim(),
      source: 'online_static',
      label: 'Priority 5: Online Static (Cached)',
    };
  }

  return {
    type: 'none',
    content: '',
    source: 'none',
    label: 'No Lyrics Found',
  };
}

// --- FETCH & CACHE FROM LRCLIB ---

export async function fetchAndCacheLyricsForTrack(
  track: LibraryTrack,
  force: boolean = false
): Promise<LibraryTrack> {
  // Check if we already have engraved lyrics in audio file or local companion synced lyrics
  if (!force && (track.embeddedSyncedLyrics || track.embeddedStaticLyrics || track.localSyncedLyrics)) {
    if (track.embeddedSyncedLyrics) track.lyricsSource = 'embedded_synced';
    else if (track.embeddedStaticLyrics) track.lyricsSource = 'embedded_static';
    else if (track.localSyncedLyrics) track.lyricsSource = 'local_synced';
    return track;
  }

  // Check persistent cache first if not forced
  if (!force) {
    const cached = getCachedLyrics(track.title, track.artist);
    if (cached) {
      if (cached.syncedLyrics) {
        track.onlineSyncedLyrics = cached.syncedLyrics;
        track.lyricsSource = 'online_synced';
        track.lyricsCachedAt = cached.cachedAt;
        return track;
      }
      if (cached.plainLyrics) {
        track.onlineStaticLyrics = cached.plainLyrics;
        track.lyricsSource = 'online_static';
        track.lyricsCachedAt = cached.cachedAt;
        return track;
      }
    }
  }

  // Query LRCLIB
  try {
    const lrclibResult = await searchFirstLyricsFromLRCLib({
      track_name: track.title,
      artist_name: track.artist || undefined,
      album_name: track.album || undefined,
      duration: track.durationSec > 0 ? track.durationSec : undefined,
    });

    if (lrclibResult) {
      if (lrclibResult.syncedLyrics) {
        track.onlineSyncedLyrics = lrclibResult.syncedLyrics;
        track.lyricsSource = 'online_synced';
      }
      if (lrclibResult.plainLyrics) {
        track.onlineStaticLyrics = lrclibResult.plainLyrics;
        if (!track.onlineSyncedLyrics) {
          track.lyricsSource = 'online_static';
        }
      }

      track.lyricsCachedAt = new Date().toISOString();

      // Write to persistent cache
      setCachedLyrics(
        track.title,
        track.artist,
        lrclibResult.syncedLyrics || undefined,
        lrclibResult.plainLyrics || undefined
      );
    }
  } catch (err) {
    console.warn(`[LRCLIB] Lyrics query failed for ${track.title}:`, err);
  }

  return track;
}

// --- SMART AUTO-GROUPING (ALBUMS, ARTISTS, GENRES) ---

export function getSmartAlbums(tracks: LibraryTrack[]): SmartAlbum[] {
  const albumMap = new Map<string, LibraryTrack[]>();

  for (const track of tracks) {
    const albumName = (track.album || '').trim();
    if (!albumName) continue;
    const key = albumName.toLowerCase();
    if (!albumMap.has(key)) {
      albumMap.set(key, []);
    }
    albumMap.get(key)!.push(track);
  }

  const result: SmartAlbum[] = [];
  for (const [key, albumTracks] of albumMap.entries()) {
    // Sort tracks by trackNumber if present, else by title
    albumTracks.sort((a, b) => {
      if (a.trackNumber && b.trackNumber) return a.trackNumber - b.trackNumber;
      return a.title.localeCompare(b.title);
    });

    const first = albumTracks[0];
    const totalSecs = albumTracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);
    const coverArt = albumTracks.find(t => t.coverArtUrl)?.coverArtUrl;

    result.push({
      id: `album-${key.replace(/[^a-z0-9]/g, '-')}`,
      name: first.album || 'Unknown Album',
      artist: first.albumArtist || first.artist || 'Various Artists',
      tracks: albumTracks,
      coverArtUrl: coverArt,
      totalDurationSec: totalSecs,
      year: first.year,
      genre: first.genre || 'Other',
    });
  }

  // Sort albums alphabetically
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export function getSmartArtists(tracks: LibraryTrack[]): SmartArtist[] {
  const artistMap = new Map<string, LibraryTrack[]>();

  for (const track of tracks) {
    const artistName = (track.artist || 'Unknown Artist').trim();
    const key = artistName.toLowerCase();
    if (!artistMap.has(key)) {
      artistMap.set(key, []);
    }
    artistMap.get(key)!.push(track);
  }

  const result: SmartArtist[] = [];
  for (const [, artistTracks] of artistMap.entries()) {
    const first = artistTracks[0];
    const albums = Array.from(new Set(artistTracks.map(t => t.album).filter(Boolean))) as string[];
    const totalSecs = artistTracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);

    result.push({
      name: first.artist || 'Unknown Artist',
      tracks: artistTracks,
      albums,
      totalDurationSec: totalSecs,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export function getSmartGenres(tracks: LibraryTrack[]): SmartGenre[] {
  const genreMap = new Map<string, LibraryTrack[]>();

  for (const track of tracks) {
    const genre = (track.genre || 'Unclassified').trim();
    const key = genre.toLowerCase();
    if (!genreMap.has(key)) {
      genreMap.set(key, []);
    }
    genreMap.get(key)!.push(track);
  }

  const result: SmartGenre[] = [];
  for (const [, genreTracks] of genreMap.entries()) {
    const first = genreTracks[0];
    const totalSecs = genreTracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);
    result.push({
      name: first.genre || 'Unclassified',
      tracks: genreTracks,
      totalDurationSec: totalSecs,
    });
  }

  result.sort((a, b) => b.tracks.length - a.tracks.length);
  return result;
}

// --- FOLDER IMPORT ENGINE ---

export interface FolderImportResult {
  addedTracks: LibraryTrack[];
  totalScanned: number;
  matchedLrcCount: number;
  matchedCoverCount: number;
  createdAlbumsCount: number;
}

export async function parseFolderFiles(files: FileList | File[]): Promise<FolderImportResult> {
  const fileArray = Array.from(files);
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.mid', '.midi'];
  const lrcExtensions = ['.lrc'];
  const textExtensions = ['.txt'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  // Index companion files by base path and name
  const audioFiles: File[] = [];
  const lrcMap = new Map<string, File>();
  const txtMap = new Map<string, File>();
  const imageMap = new Map<string, File>();

  for (const file of fileArray) {
    const relPath = file.webkitRelativePath || file.name;
    const ext = getFileExtension(file.name).toLowerCase();
    const baseName = getBaseFileName(file.name).toLowerCase();
    const dir = getDirectoryPath(relPath).toLowerCase();
    const fullKey = `${dir}/${baseName}`;

    if (audioExtensions.includes(ext)) {
      audioFiles.push(file);
    } else if (lrcExtensions.includes(ext)) {
      lrcMap.set(fullKey, file);
      lrcMap.set(baseName, file);
    } else if (textExtensions.includes(ext)) {
      txtMap.set(fullKey, file);
      txtMap.set(baseName, file);
    } else if (imageExtensions.includes(ext)) {
      imageMap.set(dir, file);
      imageMap.set(fullKey, file);
      imageMap.set(baseName, file);
    }
  }

  const addedTracks: LibraryTrack[] = [];
  let matchedLrcCount = 0;
  let matchedCoverCount = 0;

  for (const audio of audioFiles) {
    const relPath = audio.webkitRelativePath || audio.name;
    const baseName = getBaseFileName(audio.name);
    const dir = getDirectoryPath(relPath).toLowerCase();
    const fullKey = `${dir}/${baseName.toLowerCase()}`;

    // 1. High-fidelity ID3 Tag parsing directly from audio bytes
    const id3Meta = await parseAudioFileMetadata(audio);

    // Read companion LRC if present
    let localSyncedLyrics: string | undefined;
    const companionLrc = lrcMap.get(fullKey) || lrcMap.get(baseName.toLowerCase());
    if (companionLrc) {
      try {
        localSyncedLyrics = await companionLrc.text();
        matchedLrcCount++;
      } catch (_) {}
    }

    // Read companion text if present
    let offlineStaticLyrics: string | undefined;
    const companionTxt = txtMap.get(fullKey) || txtMap.get(baseName.toLowerCase());
    if (companionTxt) {
      try {
        offlineStaticLyrics = await companionTxt.text();
      } catch (_) {}
    }

    // Match Cover Art (embedded ID3 metadata is MAIN PRIORITY!)
    let coverArtUrl: string | undefined = id3Meta.coverArtDataUrl || id3Meta.coverArtUrl;
    const companionImg = imageMap.get(dir) || imageMap.get(fullKey) || imageMap.get(baseName.toLowerCase());

    if (!coverArtUrl && companionImg) {
      // Fallback to companion image in folder if audio does not contain embedded art
      try {
        coverArtUrl = await fileToDataUrl(companionImg);
      } catch (_) {
        coverArtUrl = URL.createObjectURL(companionImg);
      }
      matchedCoverCount++;
    } else if (coverArtUrl) {
      matchedCoverCount++;
    }

    // Measure audio duration using in-memory Audio object
    const tempBlobUrl = URL.createObjectURL(audio);
    const durationSec = await getAudioDuration(tempBlobUrl);

    // 2. Upload to server to persist in .chats/ with permanent HTTP streaming URL
    let permanentAudioUrl = '';
    let trackChatId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const formData = new FormData();
      formData.append('audio', audio);
      formData.append('title', id3Meta.title);
      formData.append('artist', id3Meta.artist);
      formData.append('album', id3Meta.album);
      formData.append('genre', id3Meta.genre || 'pop');
      formData.append('bpm', '120');
      formData.append('durationSec', (durationSec || 180).toString());

      // Send companion cover image to server if present
      if (companionImg) {
        formData.append('cover', companionImg);
      }

      // Send engraved lyrics (Priority 1) or companion LRC to server
      const syncedToSend = id3Meta.embeddedSyncedLyrics || localSyncedLyrics;
      if (syncedToSend) {
        const lrcBlob = new Blob([syncedToSend], { type: 'text/plain' });
        formData.append('lrc', lrcBlob, `${id3Meta.title}.lrc`);
      } else if (id3Meta.embeddedStaticLyrics) {
        formData.append('lrcText', id3Meta.embeddedStaticLyrics);
      }

      const uploadRes = await fetch('/api/custom-song/import', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        if (data.chat && data.chat.versions && data.chat.versions.length > 0) {
          trackChatId = data.chat.id;
          const targetMp3 = data.chat.versions[data.chat.versions.length - 1].mp3File;
          permanentAudioUrl = `/api/audio/${trackChatId}/${targetMp3}?title=${encodeURIComponent(id3Meta.title)}`;
        }
      }
    } catch (uploadErr) {
      console.warn('Server audio upload notice:', uploadErr);
    }

    // Register live in-memory audio for zero-latency local playback
    const liveBlob = registerLiveTrackAudio(trackChatId, audio);
    const finalAudioUrl = permanentAudioUrl || liveBlob;
    if (permanentAudioUrl) {
      liveBlobMap.set(trackChatId, permanentAudioUrl);
    }

    // 3. Assemble complete library track
    const initialTrack: LibraryTrack = {
      id: trackChatId,
      title: id3Meta.title,
      artist: id3Meta.artist,
      album: id3Meta.album,
      trackNumber: id3Meta.trackNumber,
      genre: id3Meta.genre || 'Pop',
      year: id3Meta.year,
      durationSec: durationSec || 180,
      audioUrl: finalAudioUrl,
      coverArtUrl: coverArtUrl || `/api/audio/${trackChatId}/cover?title=${encodeURIComponent(id3Meta.title)}`,
      dateAdded: new Date().toISOString(),
      fileSource: 'imported',
      fileName: audio.name,
      filePath: relPath,
      fileSize: audio.size,
      embeddedSyncedLyrics: id3Meta.embeddedSyncedLyrics,
      embeddedStaticLyrics: id3Meta.embeddedStaticLyrics,
      localSyncedLyrics,
      offlineStaticLyrics,
      lyricsSource: id3Meta.embeddedSyncedLyrics
        ? 'embedded_synced'
        : id3Meta.embeddedStaticLyrics
        ? 'embedded_static'
        : localSyncedLyrics
        ? 'local_synced'
        : offlineStaticLyrics
        ? 'offline_static'
        : 'none',
      customTags: [],
    };

    // 4. If no engraved or local companion lyrics, query and cache from LRCLIB
    if (initialTrack.lyricsSource === 'none') {
      await fetchAndCacheLyricsForTrack(initialTrack, false);
    }

    addedTracks.push(initialTrack);
  }

  // Save to persistent storage
  const existingTracks = loadLibraryTracks();
  const merged = [...existingTracks, ...addedTracks];
  saveLibraryTracks(merged);

  const smartAlbums = getSmartAlbums(merged);

  return {
    addedTracks,
    totalScanned: audioFiles.length,
    matchedLrcCount,
    matchedCoverCount,
    createdAlbumsCount: smartAlbums.length,
  };
}

// --- UTILITY HELPERS ---

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx !== -1 ? filename.substring(idx) : '';
}

function getBaseFileName(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt;
}

function getDirectoryPath(relPath: string): string {
  const idx = relPath.lastIndexOf('/');
  return idx !== -1 ? relPath.substring(0, idx) : '';
}

function guessTagsFromPath(relPath: string, baseName: string): {
  title: string;
  artist: string;
  album: string;
  trackNumber?: number;
  genre: string;
  year?: string;
} {
  const parts = relPath.split('/').filter(Boolean);
  let album = '';
  let artist = '';
  let title = baseName;
  let trackNumber: number | undefined;
  let genre = 'Imported';
  let year: string | undefined;

  // Check folder hierarchy: Artist/Album/Track.mp3
  if (parts.length >= 3) {
    artist = parts[parts.length - 3].replace(/^[0-9\s._-]+/, '').trim();
    album = parts[parts.length - 2].replace(/^[0-9\s._-]+/, '').trim();
  } else if (parts.length === 2) {
    album = parts[0].replace(/^[0-9\s._-]+/, '').trim();
  }

  // Pattern: "01 - Artist - Title" or "01. Artist - Title"
  const trackNumMatch = baseName.match(/^(\d{1,3})[\s._-]+(.+)$/);
  let cleanName = baseName;
  if (trackNumMatch) {
    trackNumber = parseInt(trackNumMatch[1], 10);
    cleanName = trackNumMatch[2].trim();
  }

  // Pattern: "Artist - Title"
  if (cleanName.includes(' - ')) {
    const [guessedArtist, guessedTitle] = cleanName.split(' - ', 2);
    if (!artist) artist = guessedArtist.trim();
    title = guessedTitle.trim();
  } else {
    title = cleanName.trim();
  }

  // Extract year if inside parentheses e.g. (2024)
  const yearMatch = relPath.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  return {
    title: title || 'Untitled Track',
    artist: artist || 'Unknown Artist',
    album: album || 'Single Tracks',
    trackNumber,
    genre,
    year,
  };
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio();
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      resolve(Math.round(audio.duration) || 0);
    });
    audio.addEventListener('error', () => {
      resolve(0);
    });
  });
}

/**
 * MusicSkills Studio - LRCLIB Lyrics Integration Utility
 * Queries https://lrclib.net to fetch synchronized LRC lyrics and plain lyrics.
 * Complies strictly with LRCLIB API guidelines, rate limits, and Zero-Emoji Policy.
 */

export interface LRCLibRecord {
  id: number;
  name?: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental: boolean;
  hasWordSync?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const LRCLIB_BASE_URL = 'https://lrclib.net/api';
const USER_AGENT = 'MusicSkills-Studio/1.0.0 (https://github.com/Aarav90-cpu/MusicSkills)';

export interface LRCLibQueryParams {
  track_name?: string;
  artist_name?: string;
  album_name?: string;
  duration?: number;
}

/**
 * Fetch best-matching lyrics by track signature (title, artist, album, duration)
 */
export async function getLyricsFromLRCLib(params: {
  trackName: string;
  artistName: string;
  albumName?: string;
  durationSec?: number;
}): Promise<LRCLibRecord | null> {
  const query = new URLSearchParams();
  query.set('track_name', params.trackName.trim());
  query.set('artist_name', params.artistName.trim());
  if (params.albumName) query.set('album_name', params.albumName.trim());
  if (params.durationSec && params.durationSec > 0) {
    query.set('duration', Math.round(params.durationSec).toString());
  }

  try {
    const res = await fetch(`${LRCLIB_BASE_URL}/get?${query.toString()}`, {
      headers: {
        'Lrclib-Client': USER_AGENT,
        'User-Agent': USER_AGENT,
      },
    });

    if (res.status === 200) {
      return (await res.json()) as LRCLibRecord;
    }
    if (res.status === 404) {
      // Fall back to keyword search if exact signature was not found
      return await searchFirstLyricsFromLRCLib(`${params.trackName} ${params.artistName}`);
    }
  } catch (err) {
    console.warn('LRCLIB signature fetch failed, attempting search fallback:', err);
    return await searchFirstLyricsFromLRCLib(`${params.trackName} ${params.artistName}`);
  }

  return null;
}

/**
 * Search lyrics by query keyword (track title, artist, or album)
 */
export async function searchLyricsFromLRCLib(
  queryInput: string | LRCLibQueryParams
): Promise<LRCLibRecord[]> {
  const query = new URLSearchParams();

  if (typeof queryInput === 'string') {
    if (!queryInput.trim()) return [];
    query.set('q', queryInput.trim());
  } else {
    if (queryInput.track_name) query.set('track_name', queryInput.track_name);
    if (queryInput.artist_name) query.set('artist_name', queryInput.artist_name);
    if (queryInput.album_name) query.set('album_name', queryInput.album_name);
    if (!queryInput.track_name && !queryInput.artist_name) return [];
  }

  try {
    const res = await fetch(`${LRCLIB_BASE_URL}/search?${query.toString()}`, {
      headers: {
        'Lrclib-Client': USER_AGENT,
        'User-Agent': USER_AGENT,
      },
    });

    if (res.ok) {
      return (await res.json()) as LRCLibRecord[];
    }
  } catch (err) {
    console.error('LRCLIB search error:', err);
  }

  return [];
}

/**
 * Helper to fetch the first matching synced lyric record
 */
export async function searchFirstLyricsFromLRCLib(
  queryInput: string | LRCLibQueryParams
): Promise<LRCLibRecord | null> {
  // If structured params are provided with track and artist, try exact get endpoint first
  if (typeof queryInput !== 'string' && queryInput.track_name && queryInput.artist_name) {
    const exact = await getLyricsFromLRCLib({
      trackName: queryInput.track_name,
      artistName: queryInput.artist_name,
      albumName: queryInput.album_name,
      durationSec: queryInput.duration,
    });
    if (exact) return exact;
  }

  const records = await searchLyricsFromLRCLib(queryInput);
  if (records.length === 0) return null;

  // Prefer records that have syncedLyrics
  const syncedMatch = records.find(r => Boolean(r.syncedLyrics && r.syncedLyrics.trim().length > 0));
  return syncedMatch || records[0];
}

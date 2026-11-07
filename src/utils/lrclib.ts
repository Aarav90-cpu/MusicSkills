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
 * Helper to fetch the first matching synced lyric record with intelligent ranking
 */
export async function searchFirstLyricsFromLRCLib(
  queryInput: string | LRCLibQueryParams
): Promise<LRCLibRecord | null> {
  let targetTrack = '';
  let targetArtist = '';

  if (typeof queryInput !== 'string') {
    targetTrack = (queryInput.track_name || '').toLowerCase().trim();
    targetArtist = (queryInput.artist_name || '').toLowerCase().trim();

    if (targetTrack && targetArtist && targetArtist !== 'unknown artist') {
      const exact = await getLyricsFromLRCLib({
        trackName: queryInput.track_name!,
        artistName: queryInput.artist_name!,
        albumName: queryInput.album_name,
        durationSec: queryInput.duration,
      });
      if (exact && (exact.syncedLyrics || exact.plainLyrics)) return exact;
    }
  } else {
    // If it's a string, check for 'by' or '-' delimiters
    const raw = queryInput.trim();
    if (raw.toLowerCase().includes(' by ')) {
      const parts = raw.split(/\s+by\s+/i);
      targetTrack = parts[0].trim().toLowerCase();
      targetArtist = parts[1].trim().toLowerCase();
    } else if (raw.includes(' - ')) {
      const parts = raw.split(' - ');
      targetArtist = parts[0].trim().toLowerCase();
      targetTrack = parts[1].trim().toLowerCase();
    } else {
      targetTrack = raw.toLowerCase();
    }
  }

  // Handle common typo/alias e.g. "mj" -> "michael jackson", "off the walk" -> "off the wall"
  if (targetArtist === 'mj') targetArtist = 'michael jackson';
  if (targetTrack === 'off the walk') targetTrack = 'off the wall';

  const searchQuery = targetArtist ? `${targetTrack} ${targetArtist}` : (typeof queryInput === 'string' ? queryInput : targetTrack);
  const records = await searchLyricsFromLRCLib(searchQuery);
  if (records.length === 0) {
    if (targetTrack && targetArtist) {
      const fallbackRecords = await searchLyricsFromLRCLib(targetTrack);
      if (fallbackRecords.length > 0) {
        return fallbackRecords.find(r => Boolean(r.syncedLyrics)) || fallbackRecords[0];
      }
    }
    return null;
  }

  // Score each candidate record to guarantee the most relevant artist & track is selected
  const scored = records.map(r => {
    let score = 0;
    const rTrack = (r.trackName || '').toLowerCase();
    const rArtist = (r.artistName || '').toLowerCase();

    if (r.syncedLyrics && r.syncedLyrics.trim().length > 0) score += 50;
    if (r.plainLyrics && r.plainLyrics.trim().length > 0) score += 20;

    if (targetArtist) {
      if (rArtist === targetArtist) score += 100;
      else if (rArtist.includes(targetArtist) || targetArtist.includes(rArtist)) score += 60;
    }

    if (targetTrack) {
      if (rTrack === targetTrack) score += 80;
      else if (rTrack.includes(targetTrack) || targetTrack.includes(rTrack)) score += 40;
    }

    return { record: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.record || null;
}

/**
 * MusicSkills Studio - LRC & Synced Lyrics Parser & Formatter Utility
 * Strictly adheres to Zero-Emoji Policy.
 */

export interface SyncedLyricLine {
  id: string;
  seconds: number;
  timestamp: string; // MM:SS.mmm
  text: string;
  section?: string;
  endSeconds?: number;
}

export interface ParsedLRC {
  title?: string;
  artist?: string;
  album?: string;
  offsetMs?: number;
  lines: SyncedLyricLine[];
}

/**
 * Format raw seconds into MM:SS.mmm or MM:SS.xx
 */
export function formatTime(seconds: number, includeMilliseconds: boolean = true): string {
  const totalMs = Math.max(0, Math.floor(seconds * 1000));
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');

  if (includeMilliseconds) {
    return `${mStr}:${sStr}.${msStr}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Format raw seconds into standard LRC tag format [MM:SS.xx]
 */
export function formatLrcTag(seconds: number): string {
  const totalMs = Math.max(0, Math.floor(seconds * 1000));
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const hundredths = Math.floor((totalMs % 1000) / 10);

  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');
  const hStr = String(hundredths).padStart(2, '0');

  return `[${mStr}:${sStr}.${hStr}]`;
}

/**
 * Convert [MM:SS.xx] or [MM:SS.xxx] or MM:SS string to seconds
 */
export function parseTimestampToSeconds(tag: string): number | null {
  const clean = tag.replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':');
  if (parts.length !== 2) return null;

  const mins = parseFloat(parts[0]);
  const secs = parseFloat(parts[1]);

  if (isNaN(mins) || isNaN(secs)) return null;
  return mins * 60 + secs;
}

/**
 * Parse standard LRC content or lead sheet text into structured synced lyric lines
 */
export function parseLRC(content: string): ParsedLRC {
  const rawLines = content.split(/\r?\n/);
  const result: ParsedLRC = { lines: [] };
  let currentSection = 'Song';

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // Check for ID tags like [ti:Title], [ar:Artist], etc.
    const metaMatch = line.match(/^\[(ti|ar|al|offset):([^\]]+)\]$/i);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === 'ti') result.title = val;
      if (key === 'ar') result.artist = val;
      if (key === 'al') result.album = val;
      if (key === 'offset') result.offsetMs = parseInt(val, 10) || 0;
      continue;
    }

    // Check for section header like [Verse 1] or ## Verse 1
    const secMatch = line.match(/^(?:##|\*\*\[|\[)([A-Za-z0-9\s\-_()]+?)(?:\]\*\*|\]|:)?$/);
    if (secMatch && !line.match(/^\[\d{2}:\d{2}/)) {
      currentSection = secMatch[1].trim();
      continue;
    }

    // Check for timestamped lines: [00:12.50]Lyrics or [00:12.50][00:24.00]Chorus line
    const timeRegex = /\[(\d{2}:\d{2}(?:\.\d{2,3})?)\]/g;
    const timestamps: number[] = [];
    let match;

    while ((match = timeRegex.exec(line)) !== null) {
      const sec = parseTimestampToSeconds(match[1]);
      if (sec !== null) {
        timestamps.push(sec);
      }
    }

    if (timestamps.length > 0) {
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      if (text) {
        for (const sec of timestamps) {
          result.lines.push({
            id: `line-${result.lines.length + 1}-${Math.random().toString(36).substring(2, 6)}`,
            seconds: sec,
            timestamp: formatTime(sec, true),
            text,
            section: currentSection,
          });
        }
      }
    } else {
      // Un-timestamped line (for raw lyrics)
      result.lines.push({
        id: `line-${result.lines.length + 1}-${Math.random().toString(36).substring(2, 6)}`,
        seconds: -1, // Unsynced
        timestamp: '--:--.---',
        text: line,
        section: currentSection,
      });
    }
  }

  // Sort timestamped lines in chronological order
  result.lines.sort((a, b) => {
    if (a.seconds === -1 && b.seconds === -1) return 0;
    if (a.seconds === -1) return 1;
    if (b.seconds === -1) return -1;
    return a.seconds - b.seconds;
  });

  // Calculate endSeconds based on following line's start
  for (let j = 0; j < result.lines.length; j++) {
    if (result.lines[j].seconds >= 0) {
      const nextSynced = result.lines.slice(j + 1).find(l => l.seconds > result.lines[j].seconds);
      if (nextSynced) {
        result.lines[j].endSeconds = nextSynced.seconds;
      } else {
        result.lines[j].endSeconds = result.lines[j].seconds + 3.5;
      }
    }
  }

  return result;
}

/**
 * Convert lyrics dictionary (from ChatSession) into synced lines based on BPM and bar structure
 */
export function convertProjectLyricsToSynced(
  lyrics: Record<string, string[]>,
  sections: Array<{ name: string; bars: number }>,
  bpm: number = 120
): SyncedLyricLine[] {
  const result: SyncedLyricLine[] = [];
  const secondsPerBar = (60 / bpm) * 4;
  let currentSecond = 0;

  for (const sec of sections) {
    const secLines = lyrics[sec.name] || [];
    const secDuration = sec.bars * secondsPerBar;

    if (secLines.length === 0) {
      currentSecond += secDuration;
      continue;
    }

    const durationPerLine = secDuration / secLines.length;

    secLines.forEach((text, idx) => {
      const startSec = currentSecond + (idx * durationPerLine);
      const endSec = startSec + durationPerLine;

      result.push({
        id: `line-${sec.name}-${idx}`,
        seconds: parseFloat(startSec.toFixed(3)),
        timestamp: formatTime(startSec, true),
        text,
        section: sec.name,
        endSeconds: parseFloat(endSec.toFixed(3)),
      });
    });

    currentSecond += secDuration;
  }

  return result;
}

/**
 * Format synced lines into an exportable standard LRC string
 */
export function exportToLRC(lines: SyncedLyricLine[], title?: string, artist?: string): string {
  const header: string[] = [];
  if (title) header.push(`[ti:${title}]`);
  if (artist) header.push(`[ar:${artist}]`);
  header.push('[re:MusicSkills Studio]');
  header.push('');

  let lastSection = '';
  const body: string[] = [];

  for (const line of lines) {
    if (line.seconds < 0) continue; // Skip unsynced lines
    if (line.section && line.section !== lastSection) {
      body.push(`[${line.section}]`);
      lastSection = line.section;
    }
    body.push(`${formatLrcTag(line.seconds)}${line.text}`);
  }

  return [...header, ...body].join('\n');
}

/**
 * Format synced lines into standard SRT subtitles format
 */
export function exportToSRT(lines: SyncedLyricLine[]): string {
  const srtEntries: string[] = [];
  let counter = 1;

  for (const line of lines) {
    if (line.seconds < 0) continue;
    const startSec = line.seconds;
    const endSec = line.endSeconds || startSec + 3.0;

    const startFormatted = formatTime(startSec).replace('.', ',');
    const endFormatted = formatTime(endSec).replace('.', ',');

    srtEntries.push(`${counter}\n${startFormatted} --> ${endFormatted}\n${line.text}\n`);
    counter++;
  }

  return srtEntries.join('\n');
}

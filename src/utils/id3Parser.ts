/**
 * MusicSkills Studio - ID3 Tag & Audio Metadata Parser
 * Extracts Title, Artist, Album, Year, Genre, Track Number, and Embedded Album Art (APIC)
 * directly from MP3/audio files in the browser without external libraries.
 * Strictly zero-emoji.
 */

export interface ParsedAudioMetadata {
  title: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  trackNumber?: number;
  coverArtUrl?: string;
}

/**
 * Decode syncsafe integer from ID3v2 header or v2.4 frames
 */
function decodeSyncSafeInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

/**
 * Decode normal 32-bit big-endian integer (ID3v2.3 frame size)
 */
function decodeInt32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

/**
 * Decode text frame using appropriate character encoding
 */
function decodeText(bytes: Uint8Array, encodingByte: number): string {
  try {
    if (encodingByte === 0) {
      // ISO-8859-1 (Latin1)
      const decoder = new TextDecoder('iso-8859-1');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else if (encodingByte === 1) {
      // UTF-16 with BOM
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else if (encodingByte === 2) {
      // UTF-16BE without BOM
      const decoder = new TextDecoder('utf-16be');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else if (encodingByte === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    }
  } catch (_) {}

  // Fallback UTF-8
  return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim();
}

/**
 * Parse ID3v2 tags from array buffer
 */
function parseID3v2(buffer: ArrayBuffer): Partial<ParsedAudioMetadata> | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return null;

  // Check ID3 magic bytes
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null; // Not ID3v2
  }

  const versionMajor = bytes[3]; // 3 for ID3v2.3, 4 for ID3v2.4
  const flags = bytes[5];
  const tagSize = decodeSyncSafeInt(bytes, 6);
  const totalHeaderSize = 10 + (flags & 0x10 ? 10 : 0); // Footer present?

  let offset = 10;
  // If extended header is present, skip it
  if (flags & 0x40 && offset < bytes.length) {
    const extSize = versionMajor === 4 ? decodeSyncSafeInt(bytes, offset) : decodeInt32(bytes, offset);
    offset += extSize;
  }

  const metadata: Partial<ParsedAudioMetadata> = {};
  const maxOffset = Math.min(bytes.length, 10 + tagSize);

  while (offset + 10 <= maxOffset) {
    // Read frame ID (4 ASCII characters)
    let frameId = '';
    for (let i = 0; i < 4; i++) {
      const c = bytes[offset + i];
      if (c >= 32 && c <= 126) frameId += String.fromCharCode(c);
      else break;
    }

    if (frameId.length < 4) break; // Padding reached

    const frameSize = versionMajor === 4
      ? decodeSyncSafeInt(bytes, offset + 4)
      : decodeInt32(bytes, offset + 4);

    if (frameSize <= 0 || offset + 10 + frameSize > maxOffset + 10) break;

    const frameDataOffset = offset + 10;
    const frameData = bytes.subarray(frameDataOffset, frameDataOffset + frameSize);

    if (frameData.length > 1) {
      const encoding = frameData[0];
      const payload = frameData.subarray(1);

      if (frameId === 'TIT2' || frameId === 'TT2') {
        metadata.title = decodeText(payload, encoding);
      } else if (frameId === 'TPE1' || frameId === 'TP1') {
        metadata.artist = decodeText(payload, encoding);
      } else if (frameId === 'TALB' || frameId === 'TAL') {
        metadata.album = decodeText(payload, encoding);
      } else if (frameId === 'TYER' || frameId === 'TDRC') {
        metadata.year = decodeText(payload, encoding).substring(0, 4);
      } else if (frameId === 'TCON' || frameId === 'TCO') {
        metadata.genre = decodeText(payload, encoding);
      } else if (frameId === 'TRCK' || frameId === 'TRK') {
        const raw = decodeText(payload, encoding);
        const match = raw.match(/^(\d+)/);
        if (match) metadata.trackNumber = parseInt(match[1], 10);
      } else if (frameId === 'APIC' || frameId === 'PIC') {
        try {
          let pos = 1; // start after encoding
          let mime = 'image/jpeg';

          if (versionMajor === 2) {
            // ID3v2.2 uses 3 bytes image format
            pos += 3;
          } else {
            // ID3v2.3/2.4 uses null-terminated MIME string
            let mimeEnd = pos;
            while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0) {
              mimeEnd++;
            }
            if (mimeEnd > pos) {
              mime = new TextDecoder('iso-8859-1').decode(frameData.subarray(pos, mimeEnd));
            }
            pos = mimeEnd + 1;
          }

          pos++; // Skip picture type byte

          // Skip description (null-terminated according to encoding)
          if (encoding === 1 || encoding === 2) {
            // UTF-16 description (2 null bytes)
            while (pos + 1 < frameData.length) {
              if (frameData[pos] === 0 && frameData[pos + 1] === 0) {
                pos += 2;
                break;
              }
              pos += 2;
            }
          } else {
            // 1-byte null description
            while (pos < frameData.length && frameData[pos] !== 0) {
              pos++;
            }
            pos++;
          }

          if (pos < frameData.length) {
            const imgBytes = frameData.subarray(pos);
            const blob = new Blob([imgBytes], { type: mime || 'image/jpeg' });
            metadata.coverArtUrl = URL.createObjectURL(blob);
          }
        } catch (_) {}
      }
    }

    offset += 10 + frameSize;
  }

  return metadata;
}

/**
 * Parse ID3v1 tags from the last 128 bytes of an audio file
 */
function parseID3v1(buffer: ArrayBuffer): Partial<ParsedAudioMetadata> | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 128) return null;

  const tail = bytes.subarray(bytes.length - 128);
  if (tail[0] !== 0x54 || tail[1] !== 0x41 || tail[2] !== 0x47) {
    return null; // Not "TAG"
  }

  const decodeLatin = (b: Uint8Array) => new TextDecoder('iso-8859-1').decode(b).replace(/\0+$/, '').trim();

  const title = decodeLatin(tail.subarray(3, 33));
  const artist = decodeLatin(tail.subarray(33, 63));
  const album = decodeLatin(tail.subarray(63, 93));
  const year = decodeLatin(tail.subarray(93, 97));

  let trackNumber: number | undefined;
  if (tail[125] === 0 && tail[126] !== 0) {
    trackNumber = tail[126];
  }

  return {
    title: title || undefined,
    artist: artist || undefined,
    album: album || undefined,
    year: year || undefined,
    trackNumber,
  };
}

/**
 * Guess tags from file path and filename when ID3 tags are missing or incomplete
 */
export function guessTagsFromFileName(fileName: string, relativePath?: string): ParsedAudioMetadata {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const relPath = relativePath || fileName;
  const parts = relPath.split('/').filter(Boolean);

  let album = '';
  let artist = '';
  let title = baseName;
  let trackNumber: number | undefined;
  let year: string | undefined;

  // Folder structure: Artist / Album / 01 Track.mp3
  if (parts.length >= 3) {
    artist = parts[parts.length - 3].replace(/^[0-9\s._-]+/, '').trim();
    album = parts[parts.length - 2].replace(/^[0-9\s._-]+/, '').trim();
  } else if (parts.length === 2) {
    album = parts[0].replace(/^[0-9\s._-]+/, '').trim();
  }

  // Strip track numbers: "01 - Off The Wall", "01. Off The Wall", "01_Off The Wall"
  const trackNumMatch = baseName.match(/^(\d{1,3})[\s._-]+(.+)$/);
  let cleanName = baseName;
  if (trackNumMatch) {
    trackNumber = parseInt(trackNumMatch[1], 10);
    cleanName = trackNumMatch[2].trim();
  }

  // Common noise cleanup
  cleanName = cleanName
    .replace(/\s*[\(\[]\s*(?:official\s*(?:audio|video|music\s*video)?|remastered|lyrics?|visualizer|hd|hq|audio)\s*[\)\]]/gi, '')
    .trim();

  // Pattern: "Artist - Title" vs "Title - Artist"
  if (cleanName.includes(' - ')) {
    const segments = cleanName.split(' - ').map(s => s.trim()).filter(Boolean);
    if (segments.length >= 2) {
      // Heuristic: check if second segment is known artist or contains ft./feat.
      const first = segments[0];
      const second = segments[1];

      // Check for known common artist indicators
      if (first.toLowerCase().includes('feat') || first.toLowerCase().includes('ft.')) {
        title = first;
        if (!artist) artist = second;
      } else {
        if (!artist) artist = first;
        title = second;
      }
    }
  } else {
    title = cleanName;
  }

  // Extract 4-digit year e.g. (1979) or [1979]
  const yearMatch = relPath.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  return {
    title: title || 'Untitled Song',
    artist: artist || 'Unknown Artist',
    album: album || 'Single Tracks',
    year,
    trackNumber,
    genre: 'Pop',
  };
}

/**
 * Primary Parser: Inspects audio File/Blob, reads ID3 tags, and merges with fallback heuristics
 */
export async function parseAudioFileMetadata(file: File): Promise<ParsedAudioMetadata> {
  const fallback = guessTagsFromFileName(file.name, file.webkitRelativePath || file.name);

  try {
    // Read first 256KB for ID3v2 header and tags (covers most ID3v2 tags including small covers)
    const headerSlice = await file.slice(0, Math.min(file.size, 262144)).arrayBuffer();
    const v2 = parseID3v2(headerSlice);

    // If ID3v2 had title and artist, return merged metadata
    if (v2 && (v2.title || v2.artist)) {
      return {
        title: v2.title || fallback.title,
        artist: v2.artist || fallback.artist,
        album: v2.album || fallback.album,
        year: v2.year || fallback.year,
        genre: v2.genre || fallback.genre,
        trackNumber: v2.trackNumber || fallback.trackNumber,
        coverArtUrl: v2.coverArtUrl || fallback.coverArtUrl,
      };
    }

    // Try ID3v1 from tail
    if (file.size >= 128) {
      const tailSlice = await file.slice(file.size - 128, file.size).arrayBuffer();
      const v1 = parseID3v1(tailSlice);
      if (v1 && (v1.title || v1.artist)) {
        return {
          title: v1.title || fallback.title,
          artist: v1.artist || fallback.artist,
          album: v1.album || fallback.album,
          year: v1.year || fallback.year,
          genre: v1.genre || fallback.genre,
          trackNumber: v1.trackNumber || fallback.trackNumber,
          coverArtUrl: fallback.coverArtUrl,
        };
      }
    }
  } catch (err) {
    console.warn('ID3 tag reading exception, using filename heuristic:', err);
  }

  return fallback;
}


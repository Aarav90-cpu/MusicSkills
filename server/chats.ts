import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadConfig } from './config';

const execFileAsync = promisify(execFile);

export interface ChatSession {
  id: string;
  name: string;
  folderName: string;
  createdAt: string;
  updatedAt: string;
  step: 'style' | 'lyrics' | 'review' | 'generate' | 'result';
  style: {
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
  };
  lyrics: Record<string, string[]>;
  sections: Array<{ name: string; type: string; bars: number; energy: string }>;
  versions: Array<{
    version: string;
    createdAt: string;
    bpm: number;
    key: string;
    midiFile: string;
    mp3File: string;
    leadSheetFile: string;
    durationSec: number;
    notes?: string;
  }>;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  takes: Array<{
    id: string;
    section: string;
    filename: string;
    createdAt: string;
    durationSec: number;
    isFavorite: boolean;
  }>;
  coverArtUrl?: string;
}

export function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export function getChatsDir(): string {
  const config = loadConfig();
  const dir = config.chatsDir || path.resolve(process.cwd(), '.chats');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function listChats(): ChatSession[] {
  const chatsDir = getChatsDir();
  const entries = fs.readdirSync(chatsDir, { withFileTypes: true });
  const results: ChatSession[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = path.join(chatsDir, entry.name, 'chat.json');
      if (fs.existsSync(metaPath)) {
        try {
          const content = fs.readFileSync(metaPath, 'utf-8');
          const parsed = JSON.parse(content) as ChatSession;
          parsed.folderName = entry.name;
          results.push(parsed);
        } catch (err) {
          console.error(`Error reading ${metaPath}:`, err);
        }
      }
    }
  }

  // Sort descending by updatedAt
  return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getChat(id: string): { chat: ChatSession; dirPath: string } | null {
  if (!id) return null;
  const chatsDir = getChatsDir();
  if (!fs.existsSync(chatsDir)) return null;
  const entries = fs.readdirSync(chatsDir, { withFileTypes: true });

  const targetId = id.trim().toLowerCase();
  const cleanTarget = sanitizeName(id);

  // First pass: exact and prefix/suffix folder matches
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryLower = entry.name.toLowerCase();
    const dirPath = path.join(chatsDir, entry.name);
    const metaPath = path.join(dirPath, 'chat.json');

    if (
      entryLower === targetId ||
      entryLower.endsWith(`-${targetId}`) ||
      entryLower.startsWith(`${targetId}-`) ||
      entryLower.startsWith(`${cleanTarget}-`)
    ) {
      if (fs.existsSync(metaPath)) {
        try {
          const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
          chat.folderName = entry.name;
          return { chat, dirPath };
        } catch (_) {}
      }
    }
  }

  // Second pass: inspection of chat.json contents
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(chatsDir, entry.name);
    const metaPath = path.join(dirPath, 'chat.json');

    if (fs.existsSync(metaPath)) {
      try {
        const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
        if (
          (chat.id && chat.id.toLowerCase() === targetId) ||
          (chat.name && chat.name.toLowerCase() === targetId) ||
          sanitizeName(chat.name || '') === cleanTarget
        ) {
          chat.folderName = entry.name;
          return { chat, dirPath };
        }
      } catch (_) {}
    }
  }

  // Third pass: loose substring match
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryLower = entry.name.toLowerCase();
    const dirPath = path.join(chatsDir, entry.name);
    const metaPath = path.join(dirPath, 'chat.json');

    if (entryLower.includes(cleanTarget) && fs.existsSync(metaPath)) {
      try {
        const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
        chat.folderName = entry.name;
        return { chat, dirPath };
      } catch (_) {}
    }
  }

  return null;
}

export function createChat(name = 'New Song', initialStyle?: Partial<ChatSession['style']>): ChatSession {
  const chatsDir = getChatsDir();
  const id = Math.random().toString(36).substring(2, 8);
  const safeName = sanitizeName(name);
  const folderName = `${safeName}-${id}`;
  const dirPath = path.join(chatsDir, folderName);

  fs.mkdirSync(dirPath, { recursive: true });
  fs.mkdirSync(path.join(dirPath, 'vocals'), { recursive: true });

  const now = new Date().toISOString();
  const newChat: ChatSession = {
    id,
    name,
    folderName,
    createdAt: now,
    updatedAt: now,
    step: 'style',
    style: {
      topic: initialStyle?.topic || name,
      description: initialStyle?.description || '',
      genre: initialStyle?.genre || 'pop',
      subgenre: initialStyle?.subgenre || '',
      moods: initialStyle?.moods || ['energetic'],
      purposes: initialStyle?.purposes || ['dance music'],
      instrumentation: initialStyle?.instrumentation || ['synthesizer', 'electric piano'],
      vocalDelivery: initialStyle?.vocalDelivery || 'sung',
      bpm: initialStyle?.bpm || 120,
      key: initialStyle?.key || 'C',
      scale: initialStyle?.scale || 'major',
      identityLine: initialStyle?.identityLine || 'Pop + Energetic + Dance Music',
    },
    lyrics: {},
    sections: [
      { name: 'Intro', type: 'intro', bars: 4, energy: 'low' },
      { name: 'Verse 1', type: 'verse', bars: 8, energy: 'medium' },
      { name: 'Pre-Chorus', type: 'pre-chorus', bars: 4, energy: 'medium' },
      { name: 'Chorus 1', type: 'chorus', bars: 8, energy: 'high' },
      { name: 'Verse 2', type: 'verse', bars: 8, energy: 'medium' },
      { name: 'Chorus 2', type: 'chorus', bars: 8, energy: 'high' },
      { name: 'Instrumental Break', type: 'instrumental_break', bars: 4, energy: 'high' },
      { name: 'Bridge', type: 'bridge', bars: 8, energy: 'medium' },
      { name: 'Chorus 3 (Climax)', type: 'chorus', bars: 8, energy: 'climax' },
      { name: 'Outro', type: 'outro', bars: 4, energy: 'low' },
    ],
    versions: [],
    messages: [
      {
        id: 'msg-init',
        role: 'assistant',
        content: `I'm ready to craft "${name}" with you. Pick your style dimensions or tell me what sound you're going for!`,
        timestamp: now,
      },
    ],
    takes: [],
  };

  fs.writeFileSync(path.join(dirPath, 'chat.json'), JSON.stringify(newChat, null, 2), 'utf-8');
  return newChat;
}

export function saveChat(chat: ChatSession): void {
  const result = getChat(chat.id);
  if (!result) return;
  chat.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(result.dirPath, 'chat.json'), JSON.stringify(chat, null, 2), 'utf-8');
}

export function deleteChat(id: string): boolean {
  const result = getChat(id);
  if (!result) return false;
  try {
    fs.rmSync(result.dirPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error(`Failed to delete chat directory "${result.dirPath}":`, err);
    return false;
  }
}

export async function exportProjectZip(id: string): Promise<{ zipPath: string; filename: string }> {
  const result = getChat(id);
  if (!result) {
    throw new Error(`Project with ID "${id}" not found`);
  }
  const { chat, dirPath } = result;
  const safeName = sanitizeName(chat.name);
  const zipFilename = `${safeName}-${chat.id}.musicskills.zip`;
  const zipPath = path.join('/tmp', `export-${chat.id}-${Date.now()}.zip`);

  const zipBin = fs.existsSync('/usr/bin/zip') ? '/usr/bin/zip' : 'zip';
  await execFileAsync(zipBin, ['-r', zipPath, '.'], { cwd: dirPath });
  return { zipPath, filename: zipFilename };
}

export async function importProjectZip(zipFilePath: string): Promise<ChatSession> {
  const chatsDir = getChatsDir();
  const tempExtractDir = path.join('/tmp', `import-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tempExtractDir, { recursive: true });

  try {
    const unzipBin = fs.existsSync('/usr/bin/unzip') ? '/usr/bin/unzip' : 'unzip';
    await execFileAsync(unzipBin, ['-o', zipFilePath, '-d', tempExtractDir]);

    const metaPath = path.join(tempExtractDir, 'chat.json');
    if (!fs.existsSync(metaPath)) {
      throw new Error('Invalid MusicSkills project archive: missing chat.json');
    }

    const rawChat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
    const newId = Math.random().toString(36).substring(2, 8);
    const safeName = sanitizeName(rawChat.name || 'imported-project');
    const newFolderName = `${safeName}-${newId}`;
    const targetDir = path.join(chatsDir, newFolderName);

    fs.cpSync(tempExtractDir, targetDir, { recursive: true });

    rawChat.id = newId;
    rawChat.folderName = newFolderName;
    rawChat.updatedAt = new Date().toISOString();
    fs.writeFileSync(path.join(targetDir, 'chat.json'), JSON.stringify(rawChat, null, 2), 'utf-8');

    return rawChat;
  } finally {
    try {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

export function parseLrcToLyricsMap(lrcText: string): Record<string, string[]> {
  const lines = lrcText.split('\n');
  const sections: Record<string, string[]> = {};
  let currentSection = 'Main Lyrics';
  sections[currentSection] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const secMatch = trimmed.match(/^\[([A-Za-z0-9\s\-_]+)\]$/);
    if (secMatch && !trimmed.match(/^\[\d{2}:\d{2}/)) {
      currentSection = secMatch[1].trim();
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    const cleanLine = trimmed.replace(/^(\[\d{2}:\d{2}(?:\.\d{2,3})?\])+/, '').trim();
    if (cleanLine) {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(cleanLine);
    }
  }

  return Object.keys(sections).length > 0 ? sections : { 'Main Lyrics': ['[Instrumental / Synced audio track]'] };
}

/**
 * Extract embedded ID3 metadata (APIC cover art and USLT / SYLT lyrics) directly from audio bytes or file path
 */
export function extractEmbeddedId3(bufferOrPath: Buffer | string): { cover?: Buffer; mime?: string; lyrics?: string } {
  try {
    let buf: Buffer;
    if (typeof bufferOrPath === 'string') {
      if (!fs.existsSync(bufferOrPath)) return {};
      const fd = fs.openSync(bufferOrPath, 'r');
      buf = Buffer.alloc(1048576); // Read up to 1MB
      const bytesRead = fs.readSync(fd, buf, 0, 1048576, 0);
      fs.closeSync(fd);
      buf = buf.subarray(0, bytesRead);
    } else {
      buf = bufferOrPath.subarray(0, Math.min(bufferOrPath.length, 1048576));
    }

    if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) {
      return {};
    }

    const versionMajor = buf[3];
    const flags = buf[5];
    const tagSize = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);

    let offset = 10;
    if (flags & 0x40 && offset < buf.length) {
      const extSize = versionMajor === 4
        ? (((buf[offset] & 0x7f) << 21) | ((buf[offset + 1] & 0x7f) << 14) | ((buf[offset + 2] & 0x7f) << 7) | (buf[offset + 3] & 0x7f))
        : ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]);
      offset += extSize;
    }

    let cover: Buffer | undefined;
    let mime: string | undefined;
    let lyrics: string | undefined;

    const maxOffset = Math.min(buf.length, 10 + tagSize);

    while (offset + 10 <= maxOffset) {
      let frameId = '';
      for (let i = 0; i < 4; i++) {
        const c = buf[offset + i];
        if (c >= 32 && c <= 126) frameId += String.fromCharCode(c);
        else break;
      }
      if (frameId.length < 4) break;

      const frameSize = versionMajor === 4
        ? (((buf[offset + 4] & 0x7f) << 21) | ((buf[offset + 5] & 0x7f) << 14) | ((buf[offset + 6] & 0x7f) << 7) | (buf[offset + 7] & 0x7f))
        : ((buf[offset + 4] << 24) | (buf[offset + 5] << 16) | (buf[offset + 6] << 8) | buf[offset + 7]);

      if (frameSize <= 0 || offset + 10 + frameSize > buf.length) break;

      const frameData = buf.subarray(offset + 10, offset + 10 + frameSize);

      if ((frameId === 'APIC' || frameId === 'PIC') && !cover && frameData.length > 10) {
        try {
          const enc = frameData[0];
          let pos = 1;
          let detectedMime = 'image/jpeg';

          if (versionMajor === 2) {
            const fmt = frameData.subarray(1, 4).toString('ascii').toUpperCase();
            detectedMime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
            pos += 3;
          } else {
            let mimeEnd = pos;
            while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0) {
              mimeEnd++;
            }
            if (mimeEnd > pos) {
              detectedMime = frameData.subarray(pos, mimeEnd).toString('latin1');
            }
            pos = mimeEnd + 1;
          }

          pos++; // skip picture type

          // skip descriptor
          if (enc === 1 || enc === 2) {
            while (pos + 1 < frameData.length) {
              if (frameData[pos] === 0 && frameData[pos + 1] === 0) {
                pos += 2;
                break;
              }
              pos += 2;
            }
          } else {
            while (pos < frameData.length && frameData[pos] !== 0) {
              pos++;
            }
            pos++;
          }

          if (pos < frameData.length) {
            cover = Buffer.from(frameData.subarray(pos));
            mime = detectedMime;
          }
        } catch (_) {}
      } else if ((frameId === 'SYLT' || frameId === 'SLT') && frameData.length > 6) {
        try {
          const enc = frameData[0];
          const tsFormat = frameData[4]; // 2 = milliseconds, 1 = MPEG frames
          let descEnd = 6;
          if (enc === 1 || enc === 2) {
            while (descEnd + 1 < frameData.length) {
              if (frameData[descEnd] === 0 && frameData[descEnd + 1] === 0) {
                descEnd += 2;
                break;
              }
              descEnd += 2;
            }
          } else {
            while (descEnd < frameData.length && frameData[descEnd] !== 0) {
              descEnd++;
            }
            descEnd++;
          }

          let p = descEnd;
          const lines: { timeSec: number; text: string }[] = [];
          while (p < frameData.length) {
            let textEnd = p;
            if (enc === 1 || enc === 2) {
              while (textEnd + 1 < frameData.length && !(frameData[textEnd] === 0 && frameData[textEnd + 1] === 0)) {
                textEnd += 2;
              }
            } else {
              while (textEnd < frameData.length && frameData[textEnd] !== 0) {
                textEnd++;
              }
            }
            if (textEnd >= frameData.length) break;
            const textBytes = frameData.subarray(p, textEnd);
            let entryText = '';
            if (enc === 1 || enc === 2) entryText = textBytes.toString('utf16le');
            else if (enc === 3) entryText = textBytes.toString('utf-8');
            else entryText = textBytes.toString('latin1');
            entryText = entryText.trim();

            const afterText = enc === 1 || enc === 2 ? textEnd + 2 : textEnd + 1;
            if (afterText + 4 <= frameData.length) {
              const rawTs = (frameData[afterText] << 24) | (frameData[afterText + 1] << 16) | (frameData[afterText + 2] << 8) | frameData[afterText + 3];
              const timeSec = tsFormat === 2 ? rawTs / 1000 : rawTs / 38.28;
              if (entryText) {
                lines.push({ timeSec, text: entryText });
              }
              p = afterText + 4;
            } else {
              break;
            }
          }

          if (lines.length > 0) {
            const lrcLines = lines.map(l => {
              const m = Math.floor(l.timeSec / 60);
              const s = Math.floor(l.timeSec % 60);
              const cs = Math.floor((l.timeSec % 1) * 100);
              const mm = m.toString().padStart(2, '0');
              const ss = s.toString().padStart(2, '0');
              const xx = cs.toString().padStart(2, '0');
              return `[${mm}:${ss}.${xx}] ${l.text}`;
            });
            lyrics = lrcLines.join('\n');
          }
        } catch (_) {}
      } else if ((frameId === 'USLT' || frameId === 'ULT') && !lyrics && frameData.length > 5) {
        try {
          const enc = frameData[0];
          let descEnd = 4; // skip enc (1) + lang (3)
          if (enc === 1 || enc === 2) {
            while (descEnd + 1 < frameData.length) {
              if (frameData[descEnd] === 0 && frameData[descEnd + 1] === 0) {
                descEnd += 2;
                break;
              }
              descEnd += 2;
            }
          } else {
            while (descEnd < frameData.length && frameData[descEnd] !== 0) {
              descEnd++;
            }
            descEnd++;
          }

          if (descEnd < frameData.length) {
            const lyrBuf = frameData.subarray(descEnd);
            let text = '';
            if (enc === 1 || enc === 2) {
              text = lyrBuf.toString('utf16le');
            } else if (enc === 3) {
              text = lyrBuf.toString('utf-8');
            } else {
              text = lyrBuf.toString('latin1');
            }
            text = text.replace(/\0+$/, '').trim();
            if (text) {
              lyrics = text;
            }
          }
        } catch (_) {}
      }

      offset += 10 + frameSize;
    }

    return { cover, mime, lyrics };
  } catch (_) {
    return {};
  }
}

export async function importCustomSong(params: {
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  bpm?: number;
  durationSec?: number;
  audioBuffer: Buffer;
  audioOriginalName: string;
  lrcContent?: string;
  coverBuffer?: Buffer;
}): Promise<ChatSession> {
  const { title, artist, album, genre = 'pop', bpm = 120, durationSec = 180, audioBuffer, audioOriginalName, lrcContent, coverBuffer } = params;
  const newChat = createChat(title, {
    topic: title,
    description: artist ? (album ? `${artist} · ${album}` : `Custom import by ${artist}`) : 'Custom song import',
    genre,
    bpm,
  });

  const chatDirResult = getChat(newChat.id);
  if (!chatDirResult) throw new Error('Failed to retrieve newly created chat directory');
  const { dirPath } = chatDirResult;

  const ext = path.extname(audioOriginalName) || '.mp3';
  const audioFileName = `v1_custom${ext}`;
  fs.writeFileSync(path.join(dirPath, audioFileName), audioBuffer);

  // Extract embedded ID3 metadata (APIC cover art and USLT/SYLT lyrics)
  const embedded = extractEmbeddedId3(audioBuffer);
  if (embedded.cover) {
    fs.writeFileSync(path.join(dirPath, 'cover.jpg'), embedded.cover);
  } else if (coverBuffer && coverBuffer.length > 0) {
    fs.writeFileSync(path.join(dirPath, 'cover.jpg'), coverBuffer);
  }

  let lrcFileName = '';
  let lyricsMap: Record<string, string[]> = {};
  const effectiveLyrics = (lrcContent && lrcContent.trim()) ? lrcContent.trim() : embedded.lyrics;

  if (effectiveLyrics && effectiveLyrics.trim()) {
    lrcFileName = 'v1_custom.lrc';
    fs.writeFileSync(path.join(dirPath, lrcFileName), effectiveLyrics, 'utf-8');
    lyricsMap = parseLrcToLyricsMap(effectiveLyrics);
  } else {
    lyricsMap = { 'Lyrics': ['[Ready for lyrics synchronization]'] };
  }

  newChat.lyrics = lyricsMap;
  newChat.step = 'result';
  newChat.versions.push({
    version: 'v1',
    createdAt: new Date().toISOString(),
    bpm,
    key: 'C',
    midiFile: '',
    mp3File: audioFileName,
    leadSheetFile: lrcFileName,
    durationSec,
    notes: artist ? `Imported track by ${artist}${album ? ` from "${album}"` : ''}` : 'Imported custom audio and synced lyrics',
  });

  saveChat(newChat);
  return newChat;
}

/**
 * Scan all existing chats in .chats/ and backfill embedded cover art and lyrics from audio files
 */
export function backfillChatsMetadata(): { coverCount: number; lyricsCount: number } {
  const chatsDir = getChatsDir();
  if (!fs.existsSync(chatsDir)) return { coverCount: 0, lyricsCount: 0 };
  const entries = fs.readdirSync(chatsDir, { withFileTypes: true });

  let coverCount = 0;
  let lyricsCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(chatsDir, entry.name);
    const metaPath = path.join(dirPath, 'chat.json');
    if (!fs.existsSync(metaPath)) continue;

    const files = fs.readdirSync(dirPath);
    const mp3Files = files.filter(f => f.endsWith('.mp3'));
    if (mp3Files.length === 0) continue;

    const targetMp3 = mp3Files.find(f => f === 'v1_custom.mp3') || mp3Files[0];
    const mp3Path = path.join(dirPath, targetMp3);
    const coverPath = path.join(dirPath, 'cover.jpg');
    const lrcPath = path.join(dirPath, 'v1_custom.lrc');

    const needsCover = !fs.existsSync(coverPath);
    const needsLyrics = !fs.existsSync(lrcPath);

    if (needsCover || needsLyrics) {
      try {
        const embedded = extractEmbeddedId3(mp3Path);
        if (needsCover && embedded.cover) {
          fs.writeFileSync(coverPath, embedded.cover);
          coverCount++;
        }
        if (needsLyrics && embedded.lyrics) {
          fs.writeFileSync(lrcPath, embedded.lyrics, 'utf-8');
          lyricsCount++;

          try {
            const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
            chat.lyrics = parseLrcToLyricsMap(embedded.lyrics);
            if (chat.versions.length > 0) {
              chat.versions[chat.versions.length - 1].leadSheetFile = 'v1_custom.lrc';
            }
            saveChat(chat);
          } catch (_) {}
        }
      } catch (_) {}
    }
  }

  return { coverCount, lyricsCount };
}


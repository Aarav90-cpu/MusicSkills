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

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryLower = entry.name.toLowerCase();
    const dirPath = path.join(chatsDir, entry.name);
    const metaPath = path.join(dirPath, 'chat.json');

    if (entryLower.endsWith(`-${targetId}`) || entryLower === targetId) {
      if (fs.existsSync(metaPath)) {
        try {
          const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
          chat.folderName = entry.name;
          return { chat, dirPath };
        } catch (_) {}
      }
    }

    if (fs.existsSync(metaPath)) {
      try {
        const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
        if (chat.id && chat.id.toLowerCase() === targetId) {
          chat.folderName = entry.name;
          return { chat, dirPath };
        }
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
  fs.rmSync(result.dirPath, { recursive: true, force: true });
  return true;
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

  await execFileAsync('/usr/bin/zip', ['-r', zipPath, '.'], { cwd: dirPath });
  return { zipPath, filename: zipFilename };
}

export async function importProjectZip(zipFilePath: string): Promise<ChatSession> {
  const chatsDir = getChatsDir();
  const tempExtractDir = path.join('/tmp', `import-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tempExtractDir, { recursive: true });

  try {
    await execFileAsync('/usr/bin/unzip', ['-o', zipFilePath, '-d', tempExtractDir]);

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
}): Promise<ChatSession> {
  const { title, artist, album, genre = 'pop', bpm = 120, durationSec = 180, audioBuffer, audioOriginalName, lrcContent } = params;
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

  let lrcFileName = '';
  let lyricsMap: Record<string, string[]> = {};

  if (lrcContent && lrcContent.trim()) {
    lrcFileName = 'v1_custom.lrc';
    fs.writeFileSync(path.join(dirPath, lrcFileName), lrcContent, 'utf-8');
    lyricsMap = parseLrcToLyricsMap(lrcContent);
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


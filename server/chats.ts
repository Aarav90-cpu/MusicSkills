import fs from 'fs';
import path from 'path';
import { loadConfig } from './config';

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
  const chatsDir = getChatsDir();
  const entries = fs.readdirSync(chatsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith(`-${id}`)) {
      const dirPath = path.join(chatsDir, entry.name);
      const metaPath = path.join(dirPath, 'chat.json');
      if (fs.existsSync(metaPath)) {
        const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
        chat.folderName = entry.name;
        return { chat, dirPath };
      }
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

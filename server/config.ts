import fs from 'fs';
import path from 'path';

export interface AppConfig {
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  apiKey: string;
  creativity: number; // 0.0 to 1.0 (temperature)
  humanization: 'off' | 'light' | 'natural' | 'loose';
  mp3Bitrate: string;
  soundfontPath: string;
  theme: 'dark' | 'light' | 'system';
  chatsDir: string;
  inputDevice: string;
}

const CONFIG_FILE = path.resolve(process.cwd(), '.config.json');

const SOUNDFONT_CANDIDATES = [
  process.env.SOUNDFONT_PATH,
  '/usr/share/soundfonts/FluidR3_GM.sf2',
  '/usr/share/soundfonts/default.sf2',
  '/usr/share/sounds/sf2/FluidR3_GM.sf2',
  '/usr/local/share/soundfonts/FluidR3_GM.sf2',
  '/opt/homebrew/share/soundfonts/FluidR3_GM.sf2',
  path.resolve(process.cwd(), 'soundfonts/FluidR3_GM.sf2'),
].filter(Boolean) as string[];

export function getDiscoveredSoundfont(): string {
  for (const candidate of SOUNDFONT_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return '/usr/share/soundfonts/FluidR3_GM.sf2';
}

const DEFAULT_CONFIG: AppConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '',
  creativity: 0.7,
  humanization: 'natural',
  mp3Bitrate: '192k',
  soundfontPath: getDiscoveredSoundfont(),
  theme: 'dark', // Dark Studio Mode is priority
  chatsDir: path.resolve(process.cwd(), '.chats'),
  inputDevice: 'default',
};

export function resolveChatsDirectory(configuredPath?: string): string {
  if (!configuredPath) return path.resolve(process.cwd(), '.chats');
  if (path.isAbsolute(configuredPath)) {
    if (fs.existsSync(configuredPath)) return configuredPath;
    return path.resolve(process.cwd(), '.chats');
  }
  return path.resolve(process.cwd(), configuredPath);
}

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const chatsDir = resolveChatsDirectory(parsed.chatsDir);
      const soundfontPath = parsed.soundfontPath && fs.existsSync(parsed.soundfontPath)
        ? parsed.soundfontPath
        : getDiscoveredSoundfont();

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        chatsDir,
        soundfontPath,
      };
    }
  } catch (err) {
    console.error('Error loading .config.json:', err);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(updates: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const merged = { ...current, ...updates };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving .config.json:', err);
  }
  return merged;
}

export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••' + key.slice(-2);
  return '••••••••' + key.slice(-4);
}


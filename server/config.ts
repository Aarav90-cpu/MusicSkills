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

const DEFAULT_CONFIG: AppConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '',
  creativity: 0.7,
  humanization: 'natural',
  mp3Bitrate: '192k',
  soundfontPath: '/usr/share/soundfonts/FluidR3_GM.sf2',
  theme: 'dark', // Dark Studio Mode is priority
  chatsDir: path.resolve(process.cwd(), '.chats'),
  inputDevice: 'default',
};

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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


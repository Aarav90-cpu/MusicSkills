import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { loadConfig } from './config';

const execAsync = promisify(exec);

export interface RenderResult {
  midiFile: string;
  mp3File: string;
  leadSheetFile: string;
  lrcFile: string;
  srtFile: string;
  timingJsonFile: string;
  durationSec: number;
  peaks: number[];
}

const VALID_GENRES = ['pop', 'hip-hop', 'rock', 'electronic', 'phonk', 'indian', 'jazz', 'country', 'reggae', 'metal'];

function normalizeGenre(genre: string): string {
  if (!genre) return 'pop';
  const g = genre.toLowerCase().trim();
  if (VALID_GENRES.includes(g)) return g;
  if (['synthwave', 'edm', 'techno', 'house', 'trance', 'dubstep', 'dnb', 'ambient', 'disco', 'dance'].some(k => g.includes(k))) return 'electronic';
  if (['rap', 'trap', 'drill', 'hip hop', 'boom bap'].some(k => g.includes(k))) return 'hip-hop';
  if (['punk', 'indie', 'grunge', 'alternative', 'alt'].some(k => g.includes(k))) return 'rock';
  if (['bollywood', 'carnatic', 'hindustani', 'desi', 'raga', 'bhangra'].some(k => g.includes(k))) return 'indian';
  if (['bebop', 'swing', 'blues'].some(k => g.includes(k))) return 'jazz';
  if (['folk', 'bluegrass', 'americana'].some(k => g.includes(k))) return 'country';
  if (['ska', 'dancehall', 'dub'].some(k => g.includes(k))) return 'reggae';
  if (['deathcore', 'metalcore', 'heavy metal', 'thrash'].some(k => g.includes(k))) return 'metal';
  if (['drift', 'brazilian'].some(k => g.includes(k))) return 'phonk';
  return 'pop';
}

export function findSoundfontPath(): string {
  const config = loadConfig();
  const candidates = [
    config.soundfontPath,
    '/usr/share/soundfonts/FluidR3_GM.sf2',
    '/usr/share/soundfonts/FluidR3_GS.sf2',
    '/usr/share/soundfonts/default.sf2',
    '/usr/share/sounds/sf2/FluidR3_GM.sf2',
    '/usr/share/sounds/sf2/default.sf2',
    '/usr/share/soundfonts/fluid-soundfont/FluidR3_GM.sf2',
    '/opt/homebrew/share/soundfonts/FluidR3_GM.sf2',
    '/usr/local/share/soundfonts/FluidR3_GM.sf2',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  for (const d of ['/usr/share/soundfonts', '/usr/share/sounds/sf2']) {
    if (fs.existsSync(d)) {
      try {
        const files = fs.readdirSync(d);
        const sf2 = files.find(f => f.endsWith('.sf2'));
        if (sf2) return path.join(d, sf2);
      } catch (_) {}
    }
  }
  return '';
}

export async function renderMidiToAudio(
  midiPath: string,
  mp3Path: string,
  onProgress?: (stage: string) => void
): Promise<boolean> {
  const sfPath = findSoundfontPath();
  const config = loadConfig();
  const bitrate = config.mp3Bitrate || '192k';
  const wavPath = mp3Path.replace(/\.mp3$/, '_render_temp.wav');

  // Strategy A: FluidSynth with -a file -q (Fast, high-fidelity SoundFont rendering)
  if (sfPath) {
    try {
      onProgress?.('Rendering humanized multi-track audio via FluidSynth');
      await execAsync(`fluidsynth -a file -q -ni -F "${wavPath}" "${sfPath}" "${midiPath}"`);
      if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
        onProgress?.('Encoding high-fidelity MP3 master');
        await execAsync(`ffmpeg -y -i "${wavPath}" -b:a ${bitrate} "${mp3Path}"`);
        if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        if (fs.existsSync(mp3Path)) return true;
      }
    } catch (err) {
      console.warn('FluidSynth SoundFont render failed, falling back:', err);
    }
  }

  // Strategy B: Standalone Python MIDI Synthesizer Engine
  try {
    onProgress?.('Synthesizing audio via Python fallback engine');
    const pythonPath = path.resolve(process.cwd(), '.venv/bin/python');
    const pyBinary = fs.existsSync(pythonPath) ? pythonPath : 'python3';
    await execAsync(`"${pyBinary}" -m scripts.midi_synth --midi "${midiPath}" --output "${mp3Path}" --bitrate ${bitrate}`);
    if (fs.existsSync(mp3Path)) return true;
  } catch (err) {
    console.warn('Python fallback synth failed:', err);
  }

  return fs.existsSync(mp3Path);
}

export async function renderSong(params: {
  chatDir: string;
  topic: string;
  genre: string;
  mood: string;
  purpose: string;
  bpm: number;
  key: string;
  lyrics: Record<string, string[]>;
  baseName?: string;
  onProgress?: (stage: string) => void;
}): Promise<RenderResult> {
  const config = loadConfig();
  const baseName = params.baseName || 'song';
  const pythonPath = path.resolve(process.cwd(), '.venv/bin/python');
  const pyBinary = fs.existsSync(pythonPath) ? pythonPath : 'python3';

  // 1. Write lyrics to temporary JSON file
  const lyricsFile = path.join(params.chatDir, `${baseName}_lyrics_input.json`);
  fs.writeFileSync(lyricsFile, JSON.stringify(params.lyrics, null, 2), 'utf-8');

  params.onProgress?.('Composing arrangement and musical harmony');

  // 2. Run Python song generator
  const safeGenre = normalizeGenre(params.genre);
  const cmd = `"${pyBinary}" -m scripts.cli ` +
    `--topic "${params.topic.replace(/"/g, '\\"')}" ` +
    `--genre "${safeGenre}" ` +
    `--mood "${params.mood}" ` +
    `--purpose "${params.purpose}" ` +
    `--key "${params.key}" ` +
    `--bpm ${params.bpm} ` +
    `--lyrics-file "${lyricsFile}" ` +
    `--output-dir "${params.chatDir}" ` +
    `--name "${baseName}"`;

  try {
    await execAsync(cmd, { cwd: process.cwd() });
  } catch (err: any) {
    throw new Error(`Failed to generate MIDI arrangement: ${err.message}`);
  }

  const midiPath = path.join(params.chatDir, `${baseName}.mid`);
  const leadSheetPath = path.join(params.chatDir, `${baseName}_lead_sheet.md`);
  const lrcPath = path.join(params.chatDir, `${baseName}.lrc`);
  const srtPath = path.join(params.chatDir, `${baseName}.srt`);
  const timingPath = path.join(params.chatDir, `${baseName}_timing.json`);

  if (!fs.existsSync(midiPath)) {
    throw new Error(`MIDI file was not generated at expected path: ${midiPath}`);
  }

  // 3. Render MIDI to Audio MP3 (FluidSynth SoundFont primary, Python engine fallback)
  const mp3Path = path.join(params.chatDir, `${baseName}.mp3`);
  await renderMidiToAudio(midiPath, mp3Path, params.onProgress);

  // Calculate duration from timing json or estimate from BPM
  let durationSec = 180;
  if (fs.existsSync(timingPath)) {
    try {
      const timingData = JSON.parse(fs.readFileSync(timingPath, 'utf-8'));
      durationSec = timingData.total_duration_seconds || durationSec;
    } catch (e) {
      console.warn('Could not read timing JSON duration:', e);
    }
  }

  // Generate synthetic waveform peaks (100 points)
  const peaks: number[] = [];
  for (let i = 0; i < 100; i++) {
    // Generate organic musical waveform peaks
    const norm = i / 100;
    const wave = Math.sin(norm * Math.PI * 4) * 0.3 + Math.sin(norm * Math.PI * 14) * 0.2 + 0.5;
    const jitter = (Math.random() - 0.5) * 0.15;
    peaks.push(Math.max(0.08, Math.min(1.0, wave + jitter)));
  }

  return {
    midiFile: `${baseName}.mid`,
    mp3File: fs.existsSync(mp3Path) ? `${baseName}.mp3` : '',
    leadSheetFile: `${baseName}_lead_sheet.md`,
    lrcFile: `${baseName}.lrc`,
    srtFile: `${baseName}.srt`,
    timingJsonFile: `${baseName}_timing.json`,
    durationSec,
    peaks,
  };
}

export async function mixVocalTake(params: {
  chatDir: string;
  backingMp3: string;
  vocalWav: string;
  outputMp3: string;
  vocalVolume?: number;
  backingVolume?: number;
  syncOffsetMs?: number;
  reverbPercent?: number;
}): Promise<string> {
  const {
    chatDir,
    backingMp3,
    vocalWav,
    outputMp3,
    vocalVolume = 1.0,
    backingVolume = 0.8,
    syncOffsetMs = 0,
    reverbPercent = 15,
  } = params;

  const backingPath = path.join(chatDir, backingMp3);
  const vocalPath = path.join(chatDir, vocalWav);
  const outputPath = path.join(chatDir, outputMp3);

  const delaySec = (syncOffsetMs / 1000).toFixed(3);
  // ffmpeg filter complex combining delay, volume, and mixing
  const filter = `[1:a]volume=${vocalVolume},adelay=${Math.max(0, syncOffsetMs)}|${Math.max(0, syncOffsetMs)}[vocal];` +
    `[0:a]volume=${backingVolume}[backing];` +
    `[backing][vocal]amix=inputs=2:duration=longest:dropout_transition=2[out]`;

  const cmd = `ffmpeg -y -i "${backingPath}" -i "${vocalPath}" -filter_complex "${filter}" -map "[out]" -b:a 192k "${outputPath}"`;
  await execAsync(cmd);
  return outputMp3;
}


/**
 * MusicSkills Professional DAW - Sample Manager, Waveform Generator & Recorder
 * Decodes audio files, generates high-resolution waveform peaks, provides a built-in
 * library of studio samples, and records microphone input directly into timeline audio clips.
 * Strictly zero-emoji.
 */

import { dawContextManager } from './audioContext';

export interface SampleItem {
  id: string;
  name: string;
  category: 'drums' | 'kicks' | 'snares' | 'hats' | 'claps' | 'bass' | 'vocals' | 'instruments' | 'loops';
  durationSec: number;
  sampleRate: number;
  buffer: AudioBuffer;
  peaks: number[]; // 100 normalized amplitude points for waveform preview
}

export interface WaveformData {
  peaks: number[];
  durationSec: number;
  channels: number;
}

class SampleManager {
  private sampleLibrary: Map<string, SampleItem> = new Map();
  private isInitialized = false;

  // Real-time microphone recording state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime = 0;
  private isRecording = false;

  public async initializeDefaultLibrary(): Promise<void> {
    if (this.isInitialized) return;
    const ctx = dawContextManager.getContext();

    // 1. Synthesize professional studio drum & instrument samples
    this.createSynthesizedSample(ctx, 'sample_kick_808', 'Sub Punch Kick 808', 'kicks', (buf) => {
      const data = buf.getChannelData(0);
      const sr = buf.sampleRate;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const freq = 160 * Math.exp(-t * 18) + 38;
        const env = Math.exp(-t * 9);
        data[i] = Math.sin(2 * Math.PI * freq * t) * env;
      }
    }, 0.45);

    this.createSynthesizedSample(ctx, 'sample_snare_trap', 'Crisp Studio Snare', 'snares', (buf) => {
      const data = buf.getChannelData(0);
      const sr = buf.sampleRate;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const tone = Math.sin(2 * Math.PI * (190 * Math.exp(-t * 25)) * t) * Math.exp(-t * 16);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12);
        data[i] = tone * 0.45 + noise * 0.55;
      }
    }, 0.28);

    this.createSynthesizedSample(ctx, 'sample_hat_closed', 'Tight Metallic Hi-Hat', 'hats', (buf) => {
      const data = buf.getChannelData(0);
      const sr = buf.sampleRate;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 55);
        data[i] = noise * 0.8;
      }
    }, 0.08);

    this.createSynthesizedSample(ctx, 'sample_clap_studio', 'Triple Stereo Clap', 'claps', (buf) => {
      const data = buf.getChannelData(0);
      const sr = buf.sampleRate;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const burst1 = t < 0.012 ? (Math.random() * 2 - 1) * 0.6 : 0;
        const burst2 = t >= 0.012 && t < 0.024 ? (Math.random() * 2 - 1) * 0.75 : 0;
        const burst3 = t >= 0.024 ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.024) * 14) : 0;
        data[i] = burst1 + burst2 + burst3;
      }
    }, 0.3);

    this.createSynthesizedSample(ctx, 'sample_bass_808_c2', 'Deep 808 Glide Bass C2', 'bass', (buf) => {
      const data = buf.getChannelData(0);
      const sr = buf.sampleRate;
      const baseFreq = 65.41;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.2);
        const sine = Math.sin(2 * Math.PI * baseFreq * t);
        // Soft clipping saturation
        data[i] = Math.tanh(sine * 1.5) * env * 0.9;
      }
    }, 1.2);

    this.createSynthesizedSample(ctx, 'sample_piano_chord_c', 'Grand Piano C Major Chord', 'instruments', (buf) => {
      const data = buf.getChannelData(0);
      const sr = buf.sampleRate;
      const freqs = [261.63, 329.63, 392.0]; // C4, E4, G4
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 1.8);
        let s = 0;
        for (const f of freqs) {
          s += (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)) * (1 / freqs.length);
        }
        data[i] = s * env * 0.85;
      }
    }, 1.6);

    this.createSynthesizedSample(ctx, 'sample_vocal_vox_hey', 'Studio Vocal Chant Hey', 'vocals', (buf) => {
      const data = buf.getChannelData(0);
      const sr = buf.sampleRate;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const formant1 = Math.sin(2 * Math.PI * 450 * t);
        const formant2 = Math.sin(2 * Math.PI * 1800 * t) * 0.4;
        const env = Math.sin(Math.min(Math.PI, t * Math.PI * 3.5)) * Math.exp(-t * 4);
        data[i] = (formant1 + formant2) * env * 0.8;
      }
    }, 0.45);

    this.isInitialized = true;
  }

  private createSynthesizedSample(
    ctx: AudioContext,
    id: string,
    name: string,
    category: SampleItem['category'],
    generator: (buf: AudioBuffer) => void,
    durationSec: number
  ): void {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    generator(buffer);

    const peaks = this.extractPeaks(buffer, 80);
    this.sampleLibrary.set(id, {
      id,
      name,
      category,
      durationSec,
      sampleRate: ctx.sampleRate,
      buffer,
      peaks,
    });
  }

  public extractPeaks(buffer: AudioBuffer, totalPoints = 120): number[] {
    const channelData = buffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / totalPoints);
    const peaks: number[] = [];

    for (let p = 0; p < totalPoints; p++) {
      let max = 0;
      const start = p * blockSize;
      const end = Math.min(channelData.length, start + blockSize);
      for (let i = start; i < end; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > max) max = abs;
      }
      peaks.push(Math.min(1.0, max));
    }

    return peaks;
  }

  public reverseBuffer(buffer: AudioBuffer): AudioBuffer {
    const ctx = dawContextManager.getContext();
    const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c);
      const dest = reversed.getChannelData(c);
      for (let i = 0; i < buffer.length; i++) {
        dest[i] = src[buffer.length - 1 - i];
      }
    }
    return reversed;
  }

  public normalizeBuffer(buffer: AudioBuffer): AudioBuffer {
    let maxPeak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c);
      for (let i = 0; i < buffer.length; i++) {
        const abs = Math.abs(src[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }

    if (maxPeak < 0.001) return buffer;
    const multiplier = 0.98 / maxPeak;
    const ctx = dawContextManager.getContext();

    const normalized = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c);
      const dest = normalized.getChannelData(c);
      for (let i = 0; i < buffer.length; i++) {
        dest[i] = src[i] * multiplier;
      }
    }
    return normalized;
  }

  public async decodeAudioFile(file: File): Promise<{ buffer: AudioBuffer; peaks: number[] }> {
    const ctx = dawContextManager.getContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const peaks = this.extractPeaks(buffer, 120);

    return { buffer, peaks };
  }

  public getSamplesByCategory(category: string): SampleItem[] {
    const all = Array.from(this.sampleLibrary.values());
    if (category === 'all') return all;
    return all.filter((s) => s.category === category);
  }

  public getSample(id: string): SampleItem | undefined {
    return this.sampleLibrary.get(id);
  }

  public playSamplePreview(sampleId: string): void {
    const sample = this.sampleLibrary.get(sampleId);
    if (!sample) return;

    const ctx = dawContextManager.getContext();
    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.75, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  // --- REAL-TIME MICROPHONE AUDIO RECORDING ---

  public async startRecording(): Promise<void> {
    if (this.isRecording) return;

    const streamSource = await dawContextManager.initMicrophone();
    const stream = (streamSource.mediaStream);

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '',
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.recordingStartTime = Date.now();
    this.isRecording = true;
    this.mediaRecorder.start(100);
  }

  public async stopRecording(): Promise<{ buffer: AudioBuffer; peaks: number[]; durationSec: number }> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('Not currently recording');
    }

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = dawContextManager.getContext();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          const peaks = this.extractPeaks(buffer, 120);
          const durationSec = buffer.duration;

          this.isRecording = false;
          dawContextManager.stopMicrophone();
          resolve({ buffer, peaks, durationSec });
        } catch (err) {
          this.isRecording = false;
          dawContextManager.stopMicrophone();
          reject(err);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }
}

export const dawSampleManager = new SampleManager();


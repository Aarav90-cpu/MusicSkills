/**
 * MusicSkills - In-Browser DAW Audio Synthesizer & Scheduler Engine
 * High-precision Web Audio API synthesis for LMMS-style drum step sequencing,
 * multi-octave piano roll, audio clip placement, and offline WAV master rendering.
 * Strictly zero-emoji.
 */

// Note pitch to MIDI note number map
const NOTE_SEMITONES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

export function pitchToFrequency(pitch: string): number {
  const match = pitch.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) return 261.63; // Default Middle C

  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_SEMITONES[noteName] ?? 0;
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class DawAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentStep = 0;
  private timer: any = null;
  private lookaheadMs = 25;
  private scheduleAheadSec = 0.1;
  private nextStepTime = 0;
  private bpm = 120;
  private loopLengthSteps = 64; // Default 4 bars of 16th notes
  private sampleBufferCache = new Map<string, AudioBuffer>();

  public onStepTick?: (stepIndex: number, currentBar: number) => void;
  public stepScheduler?: (stepIndex: number, audioTime: number) => void;

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getContext(): AudioContext {
    return this.initContext();
  }

  // --- DRUM SYNTHESIS VOICES ---

  public playKick(time?: number, velocity = 0.9, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Pitch envelope: drops rapidly from 160Hz to 38Hz
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);

    // Amplitude envelope: snappy punch with sub tail
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(velocity * 0.95, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  public playSnare(time?: number, velocity = 0.8, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    // Body tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.1);

    oscGain.gain.setValueAtTime(velocity * 0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);

    // White noise wire snap
    const bufferSize = Math.floor(ctx.sampleRate * 0.2);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.75, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.21);
  }

  public playHiHatClosed(time?: number, velocity = 0.7, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.06);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(t);
    source.stop(t + 0.055);
  }

  public playHiHatOpen(time?: number, velocity = 0.7, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(t);
    source.stop(t + 0.33);
  }

  public playClap(time?: number, velocity = 0.8, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.25);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(2.5, t);

    const gain = ctx.createGain();
    // Multi-transient envelope
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.setValueAtTime(velocity * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.015);
    gain.gain.setValueAtTime(velocity * 0.7, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.035);
    gain.gain.setValueAtTime(velocity * 0.9, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(t);
    source.stop(t + 0.25);
  }

  public play808Sub(time?: number, pitch = 'C2', durationSec = 0.5, velocity = 0.9, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;
    const freq = pitchToFrequency(pitch);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(velocity * 0.9, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + durationSec + 0.01);
  }

  public playPerc(time?: number, velocity = 0.7, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.06);

    gain.gain.setValueAtTime(velocity * 0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  // --- MELODIC INSTRUMENT SYNTHESIS ---

  public playPianoNote(time?: number, freq = 261.63, durationSec = 0.45, velocity = 0.8, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    // Harmonic dual oscillators for warm acoustic presence
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 2, t); // Octave overtone

    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 6, 8000), t);

    gain1.gain.setValueAtTime(velocity * 0.7, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

    gain2.gain.setValueAtTime(velocity * 0.25, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + durationSec * 0.6);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + durationSec + 0.02);
    osc2.stop(t + durationSec + 0.02);
  }

  public playBassNote(time?: number, freq = 65.41, durationSec = 0.45, velocity = 0.8, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + durationSec * 0.5);
    filter.Q.setValueAtTime(3.5, t);

    gain.gain.setValueAtTime(velocity * 0.75, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + durationSec + 0.02);
  }

  public playSynthNote(time?: number, freq = 440, durationSec = 0.45, velocity = 0.7, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 1.006, t); // Subtle chorus detune

    gain.gain.setValueAtTime(velocity * 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + durationSec + 0.02);
    osc2.stop(t + durationSec + 0.02);
  }

  public playPluckNote(time?: number, freq = 523.25, durationSec = 0.25, velocity = 0.7, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 5, t);
    filter.frequency.exponentialRampToValueAtTime(freq, t + durationSec);

    gain.gain.setValueAtTime(velocity * 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + durationSec + 0.02);
  }

  public playMetronome(time?: number, isDownbeat = false, customCtx?: BaseAudioContext) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // --- AUDIO SAMPLE CACHE & PLAYBACK ---

  public async loadAudioSample(url: string): Promise<AudioBuffer | null> {
    if (this.sampleBufferCache.has(url)) {
      return this.sampleBufferCache.get(url)!;
    }

    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const ctx = this.initContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.sampleBufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.warn(`Failed to decode audio sample "${url}":`, err);
      return null;
    }
  }

  public playAudioSample(
    buffer: AudioBuffer,
    time?: number,
    offsetSec = 0,
    durationSec?: number,
    volume = 1,
    customCtx?: BaseAudioContext
  ) {
    const ctx = customCtx || this.initContext();
    const t = time ?? ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), t);

    source.connect(gain);
    gain.connect(ctx.destination);

    if (durationSec !== undefined) {
      source.start(t, offsetSec, durationSec);
    } else {
      source.start(t, offsetSec);
    }
  }

  // --- REAL-TIME LOOKAHEAD SCHEDULER ---

  public startPlayback(
    bpm: number,
    totalBars: number,
    onStepTick: (stepIndex: number, currentBar: number) => void,
    stepScheduler: (stepIndex: number, audioTime: number) => void,
    startStep = 0
  ) {
    this.stopPlayback();
    const ctx = this.initContext();

    this.bpm = Math.max(30, Math.min(300, bpm));
    this.loopLengthSteps = totalBars * 16; // 16 sixteenth-notes per 4/4 bar
    this.currentStep = startStep % this.loopLengthSteps;
    this.onStepTick = onStepTick;
    this.stepScheduler = stepScheduler;
    this.isPlaying = true;

    // Sixteenth note duration in seconds: (60 / BPM) / 4
    const stepDuration = 60 / this.bpm / 4;
    this.nextStepTime = ctx.currentTime;

    this.timer = setInterval(() => {
      if (!this.isPlaying) return;

      while (this.nextStepTime < ctx.currentTime + this.scheduleAheadSec) {
        const step = this.currentStep;
        const time = this.nextStepTime;
        const currentBar = Math.floor(step / 16) + 1;

        // Schedule musical events at exact audio context time
        this.stepScheduler?.(step, time);

        // Schedule UI tick notification
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (this.isPlaying) {
            this.onStepTick?.(step, currentBar);
          }
        }, delayMs);

        // Advance to next step
        this.nextStepTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % this.loopLengthSteps;
      }
    }, this.lookaheadMs);
  }

  public stopPlayback() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // --- OFFLINE WAV MASTER RENDERER ---

  public async renderArrangementToWav(
    bpm: number,
    totalBars: number,
    scheduleFullArrangement: (offlineCtx: OfflineAudioContext, stepDuration: number) => void
  ): Promise<Blob> {
    const stepDuration = 60 / bpm / 4;
    const totalSteps = totalBars * 16;
    const totalDurationSec = totalSteps * stepDuration + 2.0; // Add 2s reverb/release tail

    const sampleRate = 44100;
    const totalFrames = Math.ceil(totalDurationSec * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);

    // Schedule all drum, synth, piano, and bass events into the offline context
    scheduleFullArrangement(offlineCtx, stepDuration);

    const renderedBuffer = await offlineCtx.startRendering();

    // Encode rendered AudioBuffer to 16-bit PCM WAV format
    return audioBufferToWavBlob(renderedBuffer);
  }
}

/**
 * Encodes an AudioBuffer to a standard 16-bit PCM WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let result: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    result = new Float32Array(left.length + right.length);
    for (let i = 0; i < left.length; i++) {
      result[i * 2] = left[i];
      result[i * 2 + 1] = right[i];
    }
  } else {
    result = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = result.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // RIFF Chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt Sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data Sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const dawAudioEngine = new DawAudioEngine();

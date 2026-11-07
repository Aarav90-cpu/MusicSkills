/**
 * MusicSkills - Virtual Synthesizer Engine
 * Polyphonic Web Audio synthesizer with multi-timbral instrument presets,
 * configurable ADSR envelope shaping, resonant multimode filtering, and voice management.
 * Strictly zero-emoji.
 */

import { dawContextManager } from './audioContext';

export interface SynthEnvelope {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0.0 to 1.0 (gain ratio)
  release: number;  // seconds
}

export interface SynthFilterConfig {
  type: BiquadFilterType;
  cutoffHz: number;
  resonance: number;
}

export interface SynthPresetConfig {
  id: string;
  name: string;
  category: 'keys' | 'bass' | 'lead' | 'pad' | 'pluck' | 'brass';
  oscillatorType: OscillatorType;
  secondaryOscType?: OscillatorType;
  detuneSemitones?: number;
  envelope: SynthEnvelope;
  filter: SynthFilterConfig;
  masterGain: number;
}

export const SYNTH_PRESETS: Record<string, SynthPresetConfig> = {
  piano: {
    id: 'piano',
    name: 'Acoustic Grand Piano',
    category: 'keys',
    oscillatorType: 'triangle',
    secondaryOscType: 'sine',
    detuneSemitones: 0.03,
    envelope: { attack: 0.005, decay: 0.8, sustain: 0.25, release: 0.35 },
    filter: { type: 'lowpass', cutoffHz: 3500, resonance: 1.2 },
    masterGain: 0.75,
  },
  rhodes: {
    id: 'rhodes',
    name: 'Vintage Electric Rhodes',
    category: 'keys',
    oscillatorType: 'sine',
    secondaryOscType: 'triangle',
    detuneSemitones: 0.05,
    envelope: { attack: 0.01, decay: 1.2, sustain: 0.3, release: 0.4 },
    filter: { type: 'lowpass', cutoffHz: 2800, resonance: 1.8 },
    masterGain: 0.8,
  },
  bass: {
    id: 'bass',
    name: '808 Sub Bass & Reese',
    category: 'bass',
    oscillatorType: 'sawtooth',
    secondaryOscType: 'sine',
    detuneSemitones: -0.04,
    envelope: { attack: 0.015, decay: 0.4, sustain: 0.65, release: 0.25 },
    filter: { type: 'lowpass', cutoffHz: 450, resonance: 4.0 },
    masterGain: 0.85,
  },
  synth: {
    id: 'synth',
    name: 'Analog Poly Lead',
    category: 'lead',
    oscillatorType: 'sawtooth',
    secondaryOscType: 'square',
    detuneSemitones: 0.08,
    envelope: { attack: 0.02, decay: 0.5, sustain: 0.5, release: 0.3 },
    filter: { type: 'lowpass', cutoffHz: 4200, resonance: 3.5 },
    masterGain: 0.6,
  },
  pad: {
    id: 'pad',
    name: 'Atmospheric Lush Pad',
    category: 'pad',
    oscillatorType: 'sawtooth',
    secondaryOscType: 'triangle',
    detuneSemitones: 0.12,
    envelope: { attack: 0.25, decay: 1.0, sustain: 0.7, release: 0.8 },
    filter: { type: 'lowpass', cutoffHz: 1800, resonance: 2.0 },
    masterGain: 0.5,
  },
  pluck: {
    id: 'pluck',
    name: 'Chamber Plucked Harp',
    category: 'pluck',
    oscillatorType: 'triangle',
    secondaryOscType: 'sawtooth',
    detuneSemitones: 0.02,
    envelope: { attack: 0.002, decay: 0.35, sustain: 0.05, release: 0.15 },
    filter: { type: 'lowpass', cutoffHz: 5000, resonance: 2.5 },
    masterGain: 0.7,
  },
  brass: {
    id: 'brass',
    name: 'Punchy Synth Brass',
    category: 'brass',
    oscillatorType: 'sawtooth',
    secondaryOscType: 'sawtooth',
    detuneSemitones: 0.07,
    envelope: { attack: 0.04, decay: 0.3, sustain: 0.6, release: 0.2 },
    filter: { type: 'lowpass', cutoffHz: 2400, resonance: 2.2 },
    masterGain: 0.65,
  },
  bell: {
    id: 'bell',
    name: 'Crystal FM Bell',
    category: 'keys',
    oscillatorType: 'sine',
    secondaryOscType: 'triangle',
    detuneSemitones: 2.0, // Bell overtone interval
    envelope: { attack: 0.003, decay: 1.5, sustain: 0.1, release: 0.6 },
    filter: { type: 'bandpass', cutoffHz: 2200, resonance: 4.5 },
    masterGain: 0.6,
  },
};

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
  if (!match) return 261.63; // Default Middle C (C4)

  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_SEMITONES[noteName] ?? 0;
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToPitch(midiNumber: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNumber / 12) - 1;
  const semitone = midiNumber % 12;
  return `${noteNames[semitone]}${octave}`;
}

export interface ActiveVoice {
  id: string;
  pitch: string;
  osc1: OscillatorNode;
  osc2?: OscillatorNode;
  filter: BiquadFilterNode;
  gainNode: GainNode;
  destination: AudioNode;
  startTime: number;
}

export class SynthEngine {
  private activeVoices = new Map<string, ActiveVoice>();

  /**
   * Schedule a complete note event with exact duration and velocity.
   */
  public playNote(
    pitch: string,
    durationSec: number,
    velocity = 0.8,
    presetId = 'piano',
    destination?: AudioNode,
    time?: number,
    customCtx?: BaseAudioContext
  ): void {
    const ctx = customCtx || dawContextManager.getContext();
    const t = time ?? ctx.currentTime;
    const dest = destination || ctx.destination;
    const preset = SYNTH_PRESETS[presetId] || SYNTH_PRESETS.piano;
    const freq = pitchToFrequency(pitch);

    // Primary Oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = preset.oscillatorType;
    osc1.frequency.setValueAtTime(freq, t);

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = preset.filter.type;
    filter.frequency.setValueAtTime(preset.filter.cutoffHz, t);
    filter.Q.setValueAtTime(preset.filter.resonance, t);

    // Filter envelope sweep for punch
    if (preset.category === 'brass' || preset.category === 'lead') {
      filter.frequency.exponentialRampToValueAtTime(preset.filter.cutoffHz * 0.4, t + durationSec);
    }

    // Amplitude Envelope Gain
    const gain = ctx.createGain();
    const peakGain = Math.max(0.001, velocity * preset.masterGain);
    const env = preset.envelope;

    gain.gain.setValueAtTime(0.0001, t);
    // Attack
    gain.gain.linearRampToValueAtTime(peakGain, t + env.attack);
    // Decay to sustain
    const sustainLevel = Math.max(0.0001, peakGain * env.sustain);
    gain.gain.exponentialRampToValueAtTime(sustainLevel, t + env.attack + env.decay);

    // Note Release
    const noteOffTime = Math.max(t + env.attack + env.decay, t + durationSec);
    gain.gain.setValueAtTime(sustainLevel, noteOffTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteOffTime + env.release);

    osc1.connect(filter);

    // Optional Secondary Layered Oscillator (detuned chorus/thickness)
    let osc2: OscillatorNode | null = null;
    if (preset.secondaryOscType) {
      osc2 = ctx.createOscillator();
      osc2.type = preset.secondaryOscType;
      const detuneCents = (preset.detuneSemitones || 0) * 100;
      osc2.frequency.setValueAtTime(freq, t);
      osc2.detune.setValueAtTime(detuneCents, t);
      osc2.connect(filter);
      osc2.start(t);
      osc2.stop(noteOffTime + env.release + 0.05);
    }

    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc1.stop(noteOffTime + env.release + 0.05);
  }

  /**
   * Real-time attack trigger (e.g. from physical MIDI keyboard or on-screen key press).
   */
  public triggerAttack(
    pitch: string,
    velocity = 0.8,
    presetId = 'piano',
    destination?: AudioNode,
    time?: number
  ): string {
    const ctx = dawContextManager.getContext();
    const t = time ?? ctx.currentTime;
    const dest = destination || ctx.destination;
    const preset = SYNTH_PRESETS[presetId] || SYNTH_PRESETS.piano;
    const freq = pitchToFrequency(pitch);

    const voiceId = `${pitch}_${Date.now()}_${Math.random()}`;

    const osc1 = ctx.createOscillator();
    osc1.type = preset.oscillatorType;
    osc1.frequency.setValueAtTime(freq, t);

    const filter = ctx.createBiquadFilter();
    filter.type = preset.filter.type;
    filter.frequency.setValueAtTime(preset.filter.cutoffHz, t);
    filter.Q.setValueAtTime(preset.filter.resonance, t);

    const gain = ctx.createGain();
    const peakGain = Math.max(0.001, velocity * preset.masterGain);
    const env = preset.envelope;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + env.attack);
    const sustainLevel = Math.max(0.0001, peakGain * env.sustain);
    gain.gain.exponentialRampToValueAtTime(sustainLevel, t + env.attack + env.decay);

    osc1.connect(filter);

    let osc2: OscillatorNode | undefined;
    if (preset.secondaryOscType) {
      osc2 = ctx.createOscillator();
      osc2.type = preset.secondaryOscType;
      const detuneCents = (preset.detuneSemitones || 0) * 100;
      osc2.frequency.setValueAtTime(freq, t);
      osc2.detune.setValueAtTime(detuneCents, t);
      osc2.connect(filter);
      osc2.start(t);
    }

    filter.connect(gain);
    gain.connect(dest);
    osc1.start(t);

    const voice: ActiveVoice = {
      id: voiceId,
      pitch,
      osc1,
      osc2,
      filter,
      gainNode: gain,
      destination: dest,
      startTime: t,
    };

    this.activeVoices.set(voiceId, voice);
    return voiceId;
  }

  /**
   * Real-time release trigger when key is released.
   */
  public triggerRelease(voiceId: string, presetId = 'piano', time?: number): void {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    const ctx = dawContextManager.getContext();
    const t = time ?? ctx.currentTime;
    const preset = SYNTH_PRESETS[presetId] || SYNTH_PRESETS.piano;
    const env = preset.envelope;

    try {
      voice.gainNode.gain.cancelScheduledValues(t);
      voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, t);
      voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + env.release);

      setTimeout(() => {
        try {
          voice.osc1.stop();
          if (voice.osc2) voice.osc2.stop();
          voice.gainNode.disconnect();
        } catch (_) {}
        this.activeVoices.delete(voiceId);
      }, env.release * 1000 + 50);
    } catch (_) {
      this.activeVoices.delete(voiceId);
    }
  }

  /**
   * Release all currently sustaining voices (Panic / All Notes Off).
   */
  public stopAllVoices(): void {
    this.activeVoices.forEach((voice) => {
      try {
        voice.osc1.stop();
        if (voice.osc2) voice.osc2.stop();
        voice.gainNode.disconnect();
      } catch (_) {}
    });
    this.activeVoices.clear();
  }
}

export const dawSynthEngine = new SynthEngine();

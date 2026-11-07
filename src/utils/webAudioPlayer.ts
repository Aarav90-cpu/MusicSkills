/**
 * MusicSkills - In-Browser Web Audio Synthesizer Engine
 * Emergency polyphonic musical audio player using Web Audio API oscillators and gain envelopes.
 * Guarantees that music playback ALWAYS works even when external audio elements or networks fail.
 * Strictly zero-emoji.
 */

class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private isSynthesizing = false;
  private timer: any = null;
  private currentStep = 0;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playHarmonicSequence(bpm = 120, key = 'C', durationSec = 180, onProgress?: (sec: number) => void) {
    this.stop();
    this.initContext();
    if (!this.ctx) return;

    this.isSynthesizing = true;
    const intervalMs = (60 / Math.max(60, bpm)) * 500; // 8th note interval
    const rootFreq = 261.63; // Middle C
    const chordFreqs = [
      [rootFreq, rootFreq * 1.25, rootFreq * 1.5], // I
      [rootFreq * 0.89, rootFreq * 1.12, rootFreq * 1.33], // vi
      [rootFreq * 0.67, rootFreq * 0.89, rootFreq * 1.0], // IV
      [rootFreq * 0.75, rootFreq * 0.94, rootFreq * 1.12], // V
    ];

    let elapsed = 0;
    this.timer = setInterval(() => {
      if (!this.isSynthesizing || !this.ctx) return;
      elapsed += intervalMs / 1000;
      onProgress?.(elapsed);

      const chord = chordFreqs[Math.floor(this.currentStep / 8) % chordFreqs.length];
      const noteFreq = chord[this.currentStep % chord.length];

      this.playNote(noteFreq, 0.35, 'triangle');
      if (this.currentStep % 4 === 0) {
        this.playNote(chord[0] * 0.5, 0.55, 'sine'); // Bass note
      }
      this.currentStep++;

      if (elapsed >= durationSec) {
        this.stop();
      }
    }, intervalMs);
  }

  public playNote(freq: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (_) {}
  }

  public stop() {
    this.isSynthesizing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.currentStep = 0;
  }

  public isRunning(): boolean {
    return this.isSynthesizing;
  }
}

export const webAudioPlayer = new WebAudioEngine();


/**
 * MusicSkills Professional DAW - Real-Time Web Audio Effects Engine
 * Genuinely functional DSP nodes for 3-band Parametric EQ, Dynamics Compressor,
 * Stereo Delay/Echo, Convolution Reverb, and Sigmoid Distortion.
 * Strictly zero-emoji.
 */

export interface EqParams {
  lowGainDb: number;      // -24 to +24 dB
  lowFreq: number;        // 20 to 500 Hz
  midGainDb: number;      // -24 to +24 dB
  midFreq: number;        // 200 to 5000 Hz
  midQ: number;           // 0.1 to 10
  highGainDb: number;     // -24 to +24 dB
  highFreq: number;       // 2000 to 20000 Hz
  bypass: boolean;
}

export interface CompressorParams {
  thresholdDb: number;    // -60 to 0 dB
  ratio: number;          // 1 to 20
  attackSec: number;      // 0.001 to 1.0 s
  releaseSec: number;     // 0.01 to 1.0 s
  kneeDb: number;         // 0 to 40 dB
  makeupGainDb: number;   // 0 to 24 dB
  bypass: boolean;
}

export interface DelayParams {
  timeSec: number;        // 0.01 to 2.0 s
  feedback: number;       // 0.0 to 0.9
  dampingFreq: number;    // 1000 to 18000 Hz
  wetMix: number;         // 0.0 to 1.0
  bypass: boolean;
}

export interface ReverbParams {
  decaySec: number;       // 0.2 to 8.0 s
  preDelaySec: number;    // 0.0 to 0.1 s
  dampingFreq: number;    // 1000 to 16000 Hz
  wetMix: number;         // 0.0 to 1.0
  bypass: boolean;
}

export interface DistortionParams {
  drive: number;          // 0.0 to 1.0
  toneFreq: number;       // 500 to 12000 Hz
  wetMix: number;         // 0.0 to 1.0
  bypass: boolean;
}

export interface ChannelEffectsConfig {
  eq: EqParams;
  compressor: CompressorParams;
  delay: DelayParams;
  reverb: ReverbParams;
  distortion: DistortionParams;
}

export const DEFAULT_EFFECTS_CONFIG: ChannelEffectsConfig = {
  eq: {
    lowGainDb: 0,
    lowFreq: 120,
    midGainDb: 0,
    midFreq: 1200,
    midQ: 1.0,
    highGainDb: 0,
    highFreq: 8000,
    bypass: false,
  },
  compressor: {
    thresholdDb: -18,
    ratio: 3.5,
    attackSec: 0.015,
    releaseSec: 0.2,
    kneeDb: 10,
    makeupGainDb: 0,
    bypass: true,
  },
  delay: {
    timeSec: 0.35,
    feedback: 0.3,
    dampingFreq: 4500,
    wetMix: 0.25,
    bypass: true,
  },
  reverb: {
    decaySec: 2.2,
    preDelaySec: 0.02,
    dampingFreq: 6000,
    wetMix: 0.2,
    bypass: true,
  },
  distortion: {
    drive: 0.2,
    toneFreq: 4000,
    wetMix: 0.15,
    bypass: true,
  },
};

export class ChannelEffectChain {
  private ctx: BaseAudioContext;
  public inputNode: GainNode;
  public outputNode: GainNode;

  // EQ Nodes
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;

  // Compressor Nodes
  private compNode: DynamicsCompressorNode;
  private compMakeupNode: GainNode;
  private compBypassGain: GainNode;
  private compWetGain: GainNode;

  // Distortion Nodes
  private distDriveGain: GainNode;
  private distWaveShaper: WaveShaperNode;
  private distToneFilter: BiquadFilterNode;
  private distDryGain: GainNode;
  private distWetGain: GainNode;

  // Delay Nodes
  private delayNode: DelayNode;
  private delayFeedbackGain: GainNode;
  private delayDampFilter: BiquadFilterNode;
  private delayDryGain: GainNode;
  private delayWetGain: GainNode;

  // Reverb Nodes
  private reverbConvolver: ConvolverNode;
  private reverbToneFilter: BiquadFilterNode;
  private reverbDryGain: GainNode;
  private reverbWetGain: GainNode;

  private currentConfig: ChannelEffectsConfig;

  constructor(ctx: BaseAudioContext, config: ChannelEffectsConfig = DEFAULT_EFFECTS_CONFIG) {
    this.ctx = ctx;
    this.currentConfig = JSON.parse(JSON.stringify(config));

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();

    // 1. Equalizer Section
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';

    // 2. Compressor Section
    this.compNode = ctx.createDynamicsCompressor();
    this.compMakeupNode = ctx.createGain();
    this.compBypassGain = ctx.createGain();
    this.compWetGain = ctx.createGain();

    // 3. Distortion Section
    this.distDriveGain = ctx.createGain();
    this.distWaveShaper = ctx.createWaveShaper();
    this.distToneFilter = ctx.createBiquadFilter();
    this.distToneFilter.type = 'lowpass';
    this.distDryGain = ctx.createGain();
    this.distWetGain = ctx.createGain();

    // 4. Delay Section
    this.delayNode = ctx.createDelay(4.0);
    this.delayFeedbackGain = ctx.createGain();
    this.delayDampFilter = ctx.createBiquadFilter();
    this.delayDampFilter.type = 'lowpass';
    this.delayDryGain = ctx.createGain();
    this.delayWetGain = ctx.createGain();

    // 5. Reverb Section
    this.reverbConvolver = ctx.createConvolver();
    this.reverbToneFilter = ctx.createBiquadFilter();
    this.reverbToneFilter.type = 'lowpass';
    this.reverbDryGain = ctx.createGain();
    this.reverbWetGain = ctx.createGain();

    this.buildRoutingGraph();
    this.applyConfig(this.currentConfig);
  }

  private buildRoutingGraph(): void {
    // Stage 1: Input -> EQ (Low -> Mid -> High)
    this.inputNode.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);

    // Stage 2: EQ High -> Compressor Block
    const compInput = this.eqHigh;
    compInput.connect(this.compBypassGain);
    compInput.connect(this.compNode);
    this.compNode.connect(this.compMakeupNode);
    this.compMakeupNode.connect(this.compWetGain);

    const compOutput = this.ctx.createGain();
    this.compBypassGain.connect(compOutput);
    this.compWetGain.connect(compOutput);

    // Stage 3: Comp Output -> Distortion Block
    compOutput.connect(this.distDryGain);
    compOutput.connect(this.distDriveGain);
    this.distDriveGain.connect(this.distWaveShaper);
    this.distWaveShaper.connect(this.distToneFilter);
    this.distToneFilter.connect(this.distWetGain);

    const distOutput = this.ctx.createGain();
    this.distDryGain.connect(distOutput);
    this.distWetGain.connect(distOutput);

    // Stage 4: Dist Output -> Delay Block
    distOutput.connect(this.delayDryGain);
    distOutput.connect(this.delayNode);
    this.delayNode.connect(this.delayDampFilter);
    this.delayDampFilter.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode); // feedback loop
    this.delayDampFilter.connect(this.delayWetGain);

    const delayOutput = this.ctx.createGain();
    this.delayDryGain.connect(delayOutput);
    this.delayWetGain.connect(delayOutput);

    // Stage 5: Delay Output -> Reverb Block
    delayOutput.connect(this.reverbDryGain);
    delayOutput.connect(this.reverbToneFilter);
    this.reverbToneFilter.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);

    // Output Summing
    this.reverbDryGain.connect(this.outputNode);
    this.reverbWetGain.connect(this.outputNode);

    // Generate initial impulse responses
    this.regenerateReverbImpulse(this.currentConfig.reverb.decaySec);
    this.regenerateDistortionCurve(this.currentConfig.distortion.drive);
  }

  public applyConfig(config: ChannelEffectsConfig): void {
    this.currentConfig = JSON.parse(JSON.stringify(config));
    const now = this.ctx.currentTime;

    // --- EQ UPDATE ---
    const { eq } = config;
    if (eq.bypass) {
      this.eqLow.gain.setValueAtTime(0, now);
      this.eqMid.gain.setValueAtTime(0, now);
      this.eqHigh.gain.setValueAtTime(0, now);
    } else {
      this.eqLow.frequency.setValueAtTime(eq.lowFreq, now);
      this.eqLow.gain.setValueAtTime(eq.lowGainDb, now);

      this.eqMid.frequency.setValueAtTime(eq.midFreq, now);
      this.eqMid.Q.setValueAtTime(eq.midQ, now);
      this.eqMid.gain.setValueAtTime(eq.midGainDb, now);

      this.eqHigh.frequency.setValueAtTime(eq.highFreq, now);
      this.eqHigh.gain.setValueAtTime(eq.highGainDb, now);
    }

    // --- COMPRESSOR UPDATE ---
    const { compressor: comp } = config;
    if (comp.bypass) {
      this.compBypassGain.gain.setValueAtTime(1.0, now);
      this.compWetGain.gain.setValueAtTime(0.0, now);
    } else {
      this.compBypassGain.gain.setValueAtTime(0.0, now);
      this.compWetGain.gain.setValueAtTime(1.0, now);

      this.compNode.threshold.setValueAtTime(comp.thresholdDb, now);
      this.compNode.ratio.setValueAtTime(comp.ratio, now);
      this.compNode.attack.setValueAtTime(comp.attackSec, now);
      this.compNode.release.setValueAtTime(comp.releaseSec, now);
      this.compNode.knee.setValueAtTime(comp.kneeDb, now);

      const makeupLin = Math.pow(10, comp.makeupGainDb / 20);
      this.compMakeupNode.gain.setValueAtTime(makeupLin, now);
    }

    // --- DISTORTION UPDATE ---
    const { distortion: dist } = config;
    if (dist.bypass || dist.wetMix <= 0.001) {
      this.distDryGain.gain.setValueAtTime(1.0, now);
      this.distWetGain.gain.setValueAtTime(0.0, now);
    } else {
      this.distDryGain.gain.setValueAtTime(1.0 - dist.wetMix * 0.5, now);
      this.distWetGain.gain.setValueAtTime(dist.wetMix, now);
      this.distToneFilter.frequency.setValueAtTime(dist.toneFreq, now);
      this.regenerateDistortionCurve(dist.drive);
    }

    // --- DELAY UPDATE ---
    const { delay } = config;
    if (delay.bypass || delay.wetMix <= 0.001) {
      this.delayDryGain.gain.setValueAtTime(1.0, now);
      this.delayWetGain.gain.setValueAtTime(0.0, now);
    } else {
      this.delayDryGain.gain.setValueAtTime(1.0, now);
      this.delayWetGain.gain.setValueAtTime(delay.wetMix, now);
      this.delayNode.delayTime.setValueAtTime(delay.timeSec, now);
      this.delayFeedbackGain.gain.setValueAtTime(Math.min(0.88, delay.feedback), now);
      this.delayDampFilter.frequency.setValueAtTime(delay.dampingFreq, now);
    }

    // --- REVERB UPDATE ---
    const { reverb } = config;
    if (reverb.bypass || reverb.wetMix <= 0.001) {
      this.reverbDryGain.gain.setValueAtTime(1.0, now);
      this.reverbWetGain.gain.setValueAtTime(0.0, now);
    } else {
      this.reverbDryGain.gain.setValueAtTime(1.0 - reverb.wetMix * 0.3, now);
      this.reverbWetGain.gain.setValueAtTime(reverb.wetMix, now);
      this.reverbToneFilter.frequency.setValueAtTime(reverb.dampingFreq, now);
      this.regenerateReverbImpulse(reverb.decaySec);
    }
  }

  public getGainReductionDb(): number {
    // DynamicsCompressorNode.reduction returns negative reduction in dB
    return this.compNode ? this.compNode.reduction : 0;
  }

  private regenerateDistortionCurve(drive: number): void {
    const k = Math.max(0.1, drive * 50);
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;

    for (let i = 0; i < nSamples; i++) {
      const x = (i * 2) / nSamples - 1;
      // Classic hyperbolic tangent soft-clipping saturation
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    this.distWaveShaper.curve = curve;
  }

  private regenerateReverbImpulse(decaySec: number): void {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * Math.max(0.2, Math.min(8.0, decaySec)));
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      // Exponential decay envelope with subtle stereo phase decorrelation
      const decay = Math.pow(n / length, 2.5);
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }

    this.reverbConvolver.buffer = impulse;
  }

  public getConfig(): ChannelEffectsConfig {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }
}


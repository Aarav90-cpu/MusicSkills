/**
 * MusicSkills Professional DAW - Real-Time Mixer & Signal Routing Engine
 * Genuine multi-channel audio mixing graph with true Web Audio nodes,
 * insert effect chains, stereo panning, solo/mute matrix, and live peak/RMS ballistics.
 * Strictly zero-emoji.
 */

import { ChannelEffectChain, ChannelEffectsConfig, DEFAULT_EFFECTS_CONFIG } from './effectsRack';

export interface ChannelStripState {
  trackId: string;
  name: string;
  color: string;
  volumeDb: number;     // -60 to +6 dB (0 dB unity)
  pan: number;          // -1.0 (L) to +1.0 (R)
  isMuted: boolean;
  isSolo: boolean;
  isArmed: boolean;
  effects: ChannelEffectsConfig;
}

export interface MeterReadout {
  peakDb: number;       // -Infinity to +6 dB
  rmsDb: number;        // -Infinity to 0 dB
  peakLinear: number;   // 0.0 to 2.0
  rmsLinear: number;    // 0.0 to 1.0
  isClipping: boolean;
  reductionDb: number;  // Compressor gain reduction
}

export class MixerChannelNode {
  public trackId: string;
  public inputNode: GainNode;
  public effectChain: ChannelEffectChain;
  public muteGain: GainNode;
  public volumeGain: GainNode;
  public pannerNode: StereoPannerNode;
  public analyserNode: AnalyserNode;

  private pcmDataBuffer: Float32Array;
  private peakHoldTime = 0;
  private clippingHoldTime = 0;

  constructor(ctx: BaseAudioContext, trackId: string, initialConfig?: ChannelEffectsConfig) {
    this.trackId = trackId;
    this.inputNode = ctx.createGain();
    this.effectChain = new ChannelEffectChain(ctx, initialConfig || DEFAULT_EFFECTS_CONFIG);
    this.muteGain = ctx.createGain();
    this.volumeGain = ctx.createGain();
    this.pannerNode = ctx.createStereoPanner();
    this.analyserNode = ctx.createAnalyser();

    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.pcmDataBuffer = new Float32Array(this.analyserNode.frequencyBinCount);

    // Audio routing graph:
    // Input -> Effects Chain -> Mute Gain -> Volume Gain -> Panner -> Analyser
    this.inputNode.connect(this.effectChain.inputNode);
    this.effectChain.outputNode.connect(this.muteGain);
    this.muteGain.connect(this.volumeGain);
    this.volumeGain.connect(this.pannerNode);
    this.pannerNode.connect(this.analyserNode);
  }

  public setVolumeDb(volumeDb: number): void {
    // Standard logarithmic audio taper
    const clamped = Math.max(-60, Math.min(6, volumeDb));
    const linearGain = clamped <= -59 ? 0 : Math.pow(10, clamped / 20);
    this.volumeGain.gain.setValueAtTime(linearGain, this.volumeGain.context.currentTime);
  }

  public setPan(pan: number): void {
    const clamped = Math.max(-1, Math.min(1, pan));
    this.pannerNode.pan.setValueAtTime(clamped, this.pannerNode.context.currentTime);
  }

  public setMute(isMuted: boolean): void {
    this.muteGain.gain.setValueAtTime(isMuted ? 0 : 1, this.muteGain.context.currentTime);
  }

  public readMeter(): MeterReadout {
    this.analyserNode.getFloatTimeDomainData(this.pcmDataBuffer as any);

    let maxSample = 0;
    let sumSquares = 0;

    for (let i = 0; i < this.pcmDataBuffer.length; i++) {
      const val = Math.abs(this.pcmDataBuffer[i]);
      if (val > maxSample) maxSample = val;
      sumSquares += val * val;
    }

    const rmsLinear = Math.sqrt(sumSquares / this.pcmDataBuffer.length);
    const peakLinear = maxSample;

    const peakDb = peakLinear > 0.00001 ? 20 * Math.log10(peakLinear) : -100;
    const rmsDb = rmsLinear > 0.00001 ? 20 * Math.log10(rmsLinear) : -100;

    const now = Date.now();
    let isClipping = false;
    if (peakLinear >= 0.99) {
      this.clippingHoldTime = now + 1200; // Hold clipping indicator for 1.2s
      isClipping = true;
    } else if (now < this.clippingHoldTime) {
      isClipping = true;
    }

    return {
      peakDb,
      rmsDb,
      peakLinear: Math.min(2.0, peakLinear),
      rmsLinear: Math.min(1.0, rmsLinear),
      isClipping,
      reductionDb: this.effectChain.getGainReductionDb(),
    };
  }
}

export class MixerEngine {
  private ctx: BaseAudioContext;
  private channels = new Map<string, MixerChannelNode>();

  // Master Section
  public masterInput: GainNode;
  public masterEffectChain: ChannelEffectChain;
  public masterVolumeGain: GainNode;
  public masterLimiter: DynamicsCompressorNode;
  public masterAnalyser: AnalyserNode;

  private masterDataBuffer: Float32Array;
  private masterClippingHold = 0;
  private channelStates = new Map<string, ChannelStripState>();
  private masterVolumeDb = 0;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;

    this.masterInput = ctx.createGain();
    this.masterEffectChain = new ChannelEffectChain(ctx, DEFAULT_EFFECTS_CONFIG);
    this.masterVolumeGain = ctx.createGain();
    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterAnalyser = ctx.createAnalyser();

    // Brickwall mastering limiter settings
    this.masterLimiter.threshold.setValueAtTime(-0.3, ctx.currentTime);
    this.masterLimiter.ratio.setValueAtTime(20.0, ctx.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.002, ctx.currentTime);
    this.masterLimiter.release.setValueAtTime(0.05, ctx.currentTime);
    this.masterLimiter.knee.setValueAtTime(0, ctx.currentTime);

    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    this.masterDataBuffer = new Float32Array(this.masterAnalyser.frequencyBinCount);

    // Master Routing:
    // masterInput -> masterEffectChain -> masterVolumeGain -> masterLimiter -> masterAnalyser -> destination
    this.masterInput.connect(this.masterEffectChain.inputNode);
    this.masterEffectChain.outputNode.connect(this.masterVolumeGain);
    this.masterVolumeGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);

    if ('destination' in ctx) {
      this.masterAnalyser.connect((ctx as AudioContext).destination);
    }
  }

  public registerChannel(
    trackId: string,
    name: string,
    color = '#8B78FF',
    initialEffects?: ChannelEffectsConfig
  ): MixerChannelNode {
    if (this.channels.has(trackId)) {
      return this.channels.get(trackId)!;
    }

    const channelNode = new MixerChannelNode(this.ctx, trackId, initialEffects);
    // Connect channel output to master input bus
    channelNode.analyserNode.connect(this.masterInput);
    this.channels.set(trackId, channelNode);

    this.channelStates.set(trackId, {
      trackId,
      name,
      color,
      volumeDb: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      effects: channelNode.effectChain.getConfig(),
    });

    this.updateSoloMuteMatrix();
    return channelNode;
  }

  public removeChannel(trackId: string): void {
    const channel = this.channels.get(trackId);
    if (channel) {
      try {
        channel.analyserNode.disconnect();
        channel.inputNode.disconnect();
      } catch (_) {}
      this.channels.delete(trackId);
      this.channelStates.delete(trackId);
      this.updateSoloMuteMatrix();
    }
  }

  public getChannel(trackId: string): MixerChannelNode | undefined {
    return this.channels.get(trackId);
  }

  public getChannelState(trackId: string): ChannelStripState | undefined {
    return this.channelStates.get(trackId);
  }

  public getAllChannelStates(): ChannelStripState[] {
    return Array.from(this.channelStates.values());
  }

  public setChannelVolume(trackId: string, volumeDb: number): void {
    const state = this.channelStates.get(trackId);
    if (state) state.volumeDb = volumeDb;

    const node = this.channels.get(trackId);
    if (node) node.setVolumeDb(volumeDb);
  }

  public setChannelPan(trackId: string, pan: number): void {
    const state = this.channelStates.get(trackId);
    if (state) state.pan = pan;

    const node = this.channels.get(trackId);
    if (node) node.setPan(pan);
  }

  public toggleChannelMute(trackId: string): void {
    const state = this.channelStates.get(trackId);
    if (state) {
      state.isMuted = !state.isMuted;
      this.updateSoloMuteMatrix();
    }
  }

  public toggleChannelSolo(trackId: string): void {
    const state = this.channelStates.get(trackId);
    if (state) {
      state.isSolo = !state.isSolo;
      this.updateSoloMuteMatrix();
    }
  }

  public toggleChannelArm(trackId: string): void {
    const state = this.channelStates.get(trackId);
    if (state) {
      state.isArmed = !state.isArmed;
    }
  }

  public updateChannelEffects(trackId: string, effects: ChannelEffectsConfig): void {
    const state = this.channelStates.get(trackId);
    if (state) state.effects = effects;

    const node = this.channels.get(trackId);
    if (node) node.effectChain.applyConfig(effects);
  }

  public setMasterVolume(volumeDb: number): void {
    this.masterVolumeDb = Math.max(-60, Math.min(6, volumeDb));
    const linear = this.masterVolumeDb <= -59 ? 0 : Math.pow(10, this.masterVolumeDb / 20);
    this.masterVolumeGain.gain.setValueAtTime(linear, this.ctx.currentTime);
  }

  public getMasterVolumeDb(): number {
    return this.masterVolumeDb;
  }

  public updateSoloMuteMatrix(): void {
    // If ANY channel is soloed, silence all non-soloed channels regardless of mute state
    const anySoloed = Array.from(this.channelStates.values()).some((s) => s.isSolo);

    this.channelStates.forEach((state, trackId) => {
      const node = this.channels.get(trackId);
      if (!node) return;

      if (anySoloed) {
        // Must be soloed AND not explicitly muted
        node.setMute(!state.isSolo || state.isMuted);
      } else {
        node.setMute(state.isMuted);
      }
    });
  }

  public readChannelMeter(trackId: string): MeterReadout {
    const node = this.channels.get(trackId);
    if (!node) {
      return { peakDb: -100, rmsDb: -100, peakLinear: 0, rmsLinear: 0, isClipping: false, reductionDb: 0 };
    }
    return node.readMeter();
  }

  public readMasterMeter(): MeterReadout {
    this.masterAnalyser.getFloatTimeDomainData(this.masterDataBuffer as any);

    let maxSample = 0;
    let sumSquares = 0;

    for (let i = 0; i < this.masterDataBuffer.length; i++) {
      const val = Math.abs(this.masterDataBuffer[i]);
      if (val > maxSample) maxSample = val;
      sumSquares += val * val;
    }

    const rmsLinear = Math.sqrt(sumSquares / this.masterDataBuffer.length);
    const peakLinear = maxSample;

    const peakDb = peakLinear > 0.00001 ? 20 * Math.log10(peakLinear) : -100;
    const rmsDb = rmsLinear > 0.00001 ? 20 * Math.log10(rmsLinear) : -100;

    const now = Date.now();
    let isClipping = false;
    if (peakLinear >= 0.99) {
      this.masterClippingHold = now + 1200;
      isClipping = true;
    } else if (now < this.masterClippingHold) {
      isClipping = true;
    }

    return {
      peakDb,
      rmsDb,
      peakLinear: Math.min(2.0, peakLinear),
      rmsLinear: Math.min(1.0, rmsLinear),
      isClipping,
      reductionDb: this.masterLimiter.reduction,
    };
  }
}

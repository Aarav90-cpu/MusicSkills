/**
 * MusicSkills Professional DAW - Core Audio Context Wrapper
 * Authoritative Web Audio API context lifecycle, clock source, and audio input manager.
 * Strictly zero-emoji.
 */

class DawAudioContextManager {
  private ctx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass({
        latencyHint: 'interactive',
      });
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch((err) => {
        console.warn('[DAW AudioContext] Resume notice:', err);
      });
    }

    return this.ctx;
  }

  public getSampleRate(): number {
    return this.ctx ? this.ctx.sampleRate : 44100;
  }

  public getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  public getState(): AudioContextState {
    return this.ctx ? this.ctx.state : 'suspended';
  }

  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public async initMicrophone(): Promise<MediaStreamAudioSourceNode> {
    const ctx = this.getContext();
    if (this.micSourceNode && this.mediaStream) {
      return this.micSourceNode;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micSourceNode = ctx.createMediaStreamSource(this.mediaStream);
      return this.micSourceNode;
    } catch (err: any) {
      throw new Error(`Microphone access rejected: ${err.message || 'Permission denied'}`);
    }
  }

  public stopMicrophone(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch (_) {}
      this.micSourceNode = null;
    }
  }
}

export const dawContextManager = new DawAudioContextManager();

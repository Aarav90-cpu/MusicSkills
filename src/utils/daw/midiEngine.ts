/**
 * MusicSkills - Web MIDI Input & Hardware Controller Engine
 * Real-time USB MIDI controller interfacing for live keyboard performance,
 * note entry into armed sequencer tracks, and hardware status tracking.
 * Strictly zero-emoji.
 */

import { midiToPitch } from './synthEngine';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export type MidiNoteOnCallback = (midiNumber: number, pitch: string, velocity: number) => void;
export type MidiNoteOffCallback = (midiNumber: number, pitch: string) => void;
export type MidiDevicesCallback = (devices: MidiDeviceInfo[]) => void;
export type MidiActivityCallback = () => void;

export class MidiEngine {
  private midiAccess: any = null;
  private isSupported = false;
  private connectedDevices: MidiDeviceInfo[] = [];
  private noteOnListeners: Set<MidiNoteOnCallback> = new Set();
  private noteOffListeners: Set<MidiNoteOffCallback> = new Set();
  private devicesListeners: Set<MidiDevicesCallback> = new Set();
  private activityListeners: Set<MidiActivityCallback> = new Set();

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  public getConnectedDevices(): MidiDeviceInfo[] {
    return [...this.connectedDevices];
  }

  public async init(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.updateDeviceList();

      this.midiAccess.onstatechange = () => {
        this.updateDeviceList();
      };

      this.attachInputListeners();
      return true;
    } catch (err) {
      console.warn('Web MIDI API initialization rejected or unavailable:', err);
      return false;
    }
  }

  private updateDeviceList(): void {
    if (!this.midiAccess) return;

    const devices: MidiDeviceInfo[] = [];
    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      devices.push({
        id: input.id,
        name: input.name || 'Generic USB MIDI Device',
        manufacturer: input.manufacturer || 'MIDI Controller',
        state: input.state,
      });
    }

    this.connectedDevices = devices;
    this.devicesListeners.forEach((cb) => cb(devices));
    this.attachInputListeners();
  }

  private attachInputListeners(): void {
    if (!this.midiAccess) return;

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = (event: any) => this.handleMidiMessage(event);
    }
  }

  private handleMidiMessage(event: any): void {
    if (!event.data || event.data.length < 3) return;

    const [status, noteNumber, rawVelocity] = event.data;
    const command = status & 0xf0;
    const velocity = rawVelocity / 127;
    const pitch = midiToPitch(noteNumber);

    // Notify activity for UI indicator
    this.activityListeners.forEach((cb) => cb());

    // 0x90 = Note On, 0x80 = Note Off
    if (command === 0x90 && rawVelocity > 0) {
      this.noteOnListeners.forEach((cb) => cb(noteNumber, pitch, velocity));
    } else if (command === 0x80 || (command === 0x90 && rawVelocity === 0)) {
      this.noteOffListeners.forEach((cb) => cb(noteNumber, pitch));
    }
  }

  public onNoteOn(cb: MidiNoteOnCallback): () => void {
    this.noteOnListeners.add(cb);
    return () => this.noteOnListeners.delete(cb);
  }

  public onNoteOff(cb: MidiNoteOffCallback): () => void {
    this.noteOffListeners.add(cb);
    return () => this.noteOffListeners.delete(cb);
  }

  public onDevicesChanged(cb: MidiDevicesCallback): () => void {
    this.devicesListeners.add(cb);
    return () => this.devicesListeners.delete(cb);
  }

  public onActivity(cb: MidiActivityCallback): () => void {
    this.activityListeners.add(cb);
    return () => this.activityListeners.delete(cb);
  }
}

export const dawMidiEngine = new MidiEngine();

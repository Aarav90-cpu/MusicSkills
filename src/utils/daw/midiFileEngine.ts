/**
 * MusicSkills Professional DAW - Standard MIDI File (SMF Type 0/1) Encoder & Decoder
 * Enables real .mid file export and import directly in the browser with 0 external dependencies.
 * Strictly zero-emoji.
 */

import { DawClip, DawNote, DawProject } from './projectModel';
import { pitchToFrequency } from '../dawAudioEngine';

// Pitch map: note name to MIDI number (C-1 = 0, C4 = 60)
const NOTE_NAME_TO_MIDI: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export function pitchToMidiNumber(pitch: string): number {
  const match = pitch.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) return 60; // Default C4
  const name = match[1];
  const octave = parseInt(match[2], 10);
  const base = NOTE_NAME_TO_MIDI[name] ?? 0;
  return (octave + 1) * 12 + base;
}

export function midiNumberToPitch(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteName = noteNames[midi % 12];
  return `${noteName}${octave}`;
}

// Write Variable-Length Quantity (VLQ) into a byte array
function writeVLQ(bytes: number[], value: number): void {
  const buffer: number[] = [];
  buffer.push(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    buffer.push((value & 0x7f) | 0x80);
    value >>= 7;
  }
  for (let i = buffer.length - 1; i >= 0; i--) {
    bytes.push(buffer[i]);
  }
}

// Read Variable-Length Quantity from Uint8Array
function readVLQ(view: Uint8Array, offset: { val: number }): number {
  let value = 0;
  let byte = 0;
  do {
    byte = view[offset.val++];
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return value;
}

/**
 * Encodes all MIDI clips in the DawProject into a Standard MIDI File (SMF Format 1) binary Blob.
 */
export function exportProjectToMidiBlob(project: DawProject): Blob {
  const TICKS_PER_BEAT = 480;
  const TICKS_PER_STEP = TICKS_PER_BEAT / 4; // 120 ticks per 16th note step
  const TICKS_PER_BAR = TICKS_PER_BEAT * 4;  // 1920 ticks per 4/4 bar

  const midiTracks = project.tracks.filter((t) => t.type !== 'audio');
  const totalMidiTracks = midiTracks.length + 1; // +1 for Conductor / Tempo track

  const chunks: Uint8Array[] = [];

  // 1. MThd Header Chunk
  const header = new Uint8Array(14);
  header.set([0x4d, 0x54, 0x68, 0x64], 0); // "MThd"
  const headerView = new DataView(header.buffer);
  headerView.setUint32(4, 6, false);       // Header length = 6
  headerView.setUint16(8, 1, false);       // Format 1 (multi-track)
  headerView.setUint16(10, totalMidiTracks, false); // Track count
  headerView.setUint16(12, TICKS_PER_BEAT, false); // PPQN resolution
  chunks.push(header);

  // 2. Track 0: Conductor / Tempo Track
  const conductorBytes: number[] = [];
  // Delta-time 0: Set Tempo (Microseconds per quarter note)
  const usPerQuarter = Math.round(60000000 / project.bpm);
  writeVLQ(conductorBytes, 0);
  conductorBytes.push(0xff, 0x51, 0x03);
  conductorBytes.push((usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);

  // Delta-time 0: Time Signature
  writeVLQ(conductorBytes, 0);
  conductorBytes.push(0xff, 0x58, 0x04);
  conductorBytes.push(project.timeSignatureNumerator, Math.round(Math.log2(project.timeSignatureDenominator)), 24, 8);

  // Delta-time 0: Track Name "Tempo Track"
  writeVLQ(conductorBytes, 0);
  conductorBytes.push(0xff, 0x03, 11);
  for (let i = 0; i < 11; i++) conductorBytes.push('Tempo Track'.charCodeAt(i));

  // End of Track
  writeVLQ(conductorBytes, 0);
  conductorBytes.push(0xff, 0x2f, 0x00);

  const condTrack = new Uint8Array(8 + conductorBytes.length);
  condTrack.set([0x4d, 0x54, 0x72, 0x6b], 0); // "MTrk"
  new DataView(condTrack.buffer).setUint32(4, conductorBytes.length, false);
  condTrack.set(conductorBytes, 8);
  chunks.push(condTrack);

  // 3. Tracks 1..N: Instrument & MIDI Tracks
  midiTracks.forEach((track, trackIndex) => {
    const trackBytes: number[] = [];

    // Track Name Meta Event
    const nameBytes = Array.from(track.name).map((c) => c.charCodeAt(0));
    writeVLQ(trackBytes, 0);
    trackBytes.push(0xff, 0x03, nameBytes.length);
    trackBytes.push(...nameBytes);

    // Collect all note events for this track
    interface RawMidiEvent {
      absoluteTick: number;
      type: 'on' | 'off';
      note: number;
      velocity: number;
    }
    const events: RawMidiEvent[] = [];

    const trackClips = project.clips.filter((c) => c.trackId === track.id && c.type === 'midi' && !c.isMuted);
    trackClips.forEach((clip) => {
      const clipStartTick = (clip.startBar - 1) * TICKS_PER_BAR;
      (clip.notes || []).forEach((note) => {
        const startTick = clipStartTick + note.step * TICKS_PER_STEP;
        const durationTicks = Math.max(1, note.durationSteps) * TICKS_PER_STEP;
        const endTick = startTick + durationTicks;
        const midiNum = pitchToMidiNumber(note.pitch);
        const vel = Math.max(1, Math.min(127, Math.round(note.velocity * 127)));

        events.push({ absoluteTick: startTick, type: 'on', note: midiNum, velocity: vel });
        events.push({ absoluteTick: endTick, type: 'off', note: midiNum, velocity: 0 });
      });
    });

    // Sort events by absolute tick; note-off before note-on at same tick
    events.sort((a, b) => {
      if (a.absoluteTick !== b.absoluteTick) return a.absoluteTick - b.absoluteTick;
      return a.type === 'off' ? -1 : 1;
    });

    // Write events with delta ticks
    let lastTick = 0;
    const midiChannel = trackIndex % 16;
    const noteOnStatus = 0x90 | midiChannel;
    const noteOffStatus = 0x80 | midiChannel;

    events.forEach((ev) => {
      const delta = Math.max(0, ev.absoluteTick - lastTick);
      lastTick = ev.absoluteTick;
      writeVLQ(trackBytes, delta);
      if (ev.type === 'on') {
        trackBytes.push(noteOnStatus, ev.note, ev.velocity);
      } else {
        trackBytes.push(noteOffStatus, ev.note, 0);
      }
    });

    // End of Track
    writeVLQ(trackBytes, 0);
    trackBytes.push(0xff, 0x2f, 0x00);

    const midiTrackBuf = new Uint8Array(8 + trackBytes.length);
    midiTrackBuf.set([0x4d, 0x54, 0x72, 0x6b], 0); // "MTrk"
    new DataView(midiTrackBuf.buffer).setUint32(4, trackBytes.length, false);
    midiTrackBuf.set(trackBytes, 8);
    chunks.push(midiTrackBuf);
  });

  return new Blob(chunks as any[], { type: 'audio/midi' });
}

/**
 * Parses a Standard MIDI file (.mid) buffer into tracks and notes.
 */
export function parseMidiFile(buffer: ArrayBuffer): Array<{ name: string; notes: DawNote[] }> {
  const bytes = new Uint8Array(buffer);
  const offset = { val: 0 };

  const readStr = (len: number) => {
    let str = '';
    for (let i = 0; i < len; i++) str += String.fromCharCode(bytes[offset.val++]);
    return str;
  };

  const headerTag = readStr(4);
  if (headerTag !== 'MThd') {
    throw new Error('Invalid MIDI file: MThd header not found.');
  }

  const headerLen = new DataView(buffer).getUint32(offset.val, false);
  offset.val += 4;
  const format = new DataView(buffer).getUint16(offset.val, false);
  offset.val += 2;
  const numTracks = new DataView(buffer).getUint16(offset.val, false);
  offset.val += 2;
  const timeDivision = new DataView(buffer).getUint16(offset.val, false);
  offset.val += 2;

  // Skip any extra header bytes if headerLen > 6
  if (headerLen > 6) {
    offset.val += headerLen - 6;
  }

  const ticksPerBeat = (timeDivision & 0x8000) === 0 ? timeDivision : 480;
  const ticksPerStep = ticksPerBeat / 4; // 16th note

  const parsedTracks: Array<{ name: string; notes: DawNote[] }> = [];

  for (let t = 0; t < numTracks; t++) {
    if (offset.val >= bytes.length) break;
    const chunkTag = readStr(4);
    if (chunkTag !== 'MTrk') {
      // Skip unknown chunk
      const chunkLen = new DataView(buffer).getUint32(offset.val, false);
      offset.val += 4 + chunkLen;
      continue;
    }

    const trackLen = new DataView(buffer).getUint32(offset.val, false);
    offset.val += 4;
    const trackEnd = offset.val + trackLen;

    let trackName = `MIDI Track ${t + 1}`;
    let currentTick = 0;
    let runningStatus = 0;

    interface ActiveNote {
      startTick: number;
      pitch: string;
      velocity: number;
    }
    const activeNotes = new Map<number, ActiveNote>();
    const finishedNotes: DawNote[] = [];

    while (offset.val < trackEnd && offset.val < bytes.length) {
      const delta = readVLQ(bytes, offset);
      currentTick += delta;

      let status = bytes[offset.val];
      if (status >= 0x80) {
        runningStatus = status;
        offset.val++;
      } else {
        status = runningStatus;
      }

      const eventType = status & 0xf0;

      if (status === 0xff) {
        // Meta Event
        const metaType = bytes[offset.val++];
        const metaLen = readVLQ(bytes, offset);
        if (metaType === 0x03) {
          // Track Name
          let name = '';
          for (let k = 0; k < metaLen; k++) name += String.fromCharCode(bytes[offset.val + k]);
          if (name.trim()) trackName = name.trim();
        }
        offset.val += metaLen;
      } else if (status === 0xf0 || status === 0xf7) {
        // SysEx Event
        const sysexLen = readVLQ(bytes, offset);
        offset.val += sysexLen;
      } else if (eventType === 0x90) {
        // Note On
        const noteNum = bytes[offset.val++];
        const velocity = bytes[offset.val++];
        if (velocity > 0) {
          activeNotes.set(noteNum, {
            startTick: currentTick,
            pitch: midiNumberToPitch(noteNum),
            velocity: velocity / 127,
          });
        } else {
          // Note On with vel 0 is Note Off
          const active = activeNotes.get(noteNum);
          if (active) {
            const startStep = Math.round(active.startTick / ticksPerStep);
            const endStep = Math.round(currentTick / ticksPerStep);
            const durationSteps = Math.max(1, endStep - startStep);
            finishedNotes.push({
              id: `imported_note_${t}_${finishedNotes.length}`,
              pitch: active.pitch,
              step: startStep % 16,
              durationSteps,
              velocity: active.velocity,
            });
            activeNotes.delete(noteNum);
          }
        }
      } else if (eventType === 0x80) {
        // Note Off
        const noteNum = bytes[offset.val++];
        offset.val++; // velocity
        const active = activeNotes.get(noteNum);
        if (active) {
          const startStep = Math.round(active.startTick / ticksPerStep);
          const endStep = Math.round(currentTick / ticksPerStep);
          const durationSteps = Math.max(1, endStep - startStep);
          finishedNotes.push({
            id: `imported_note_${t}_${finishedNotes.length}`,
            pitch: active.pitch,
            step: startStep % 16,
            durationSteps,
            velocity: active.velocity,
          });
          activeNotes.delete(noteNum);
        }
      } else if (eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
        offset.val += 2; // Aftertouch, Control Change, Pitch Bend
      } else if (eventType === 0xc0 || eventType === 0xd0) {
        offset.val += 1; // Program Change, Channel Pressure
      }
    }

    if (finishedNotes.length > 0 || trackName !== `MIDI Track ${t + 1}`) {
      parsedTracks.push({
        name: trackName,
        notes: finishedNotes,
      });
    }
  }

  return parsedTracks;
}

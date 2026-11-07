/**
 * MusicSkills - Precreated Beat & Cover Template Presets
 * Human-engineered rhythms, chord progressions, and basslines across major musical styles.
 * Strictly zero-emoji.
 */

import { StudioNote } from '../types';

export interface BeatPreset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  key: string;
  scale: string;
  description: string;
  drumSteps: {
    kick: boolean[];
    snare: boolean[];
    hihatClosed: boolean[];
    hihatOpen: boolean[];
    clap: boolean[];
    sub808: boolean[];
    perc: boolean[];
  };
  bassNotes: StudioNote[];
  pianoNotes: StudioNote[];
}

export const BEAT_PRESETS: BeatPreset[] = [
  {
    id: 'trap-808-drift',
    name: 'Modern Trap 808 Drift',
    genre: 'hip-hop',
    bpm: 140,
    key: 'C',
    scale: 'minor',
    description: 'Half-time punchy kick, syncopated 808 sub-slides, rapid 16th hats, and minor key piano chords.',
    drumSteps: {
      kick:        [true,  false, false, false, false, false, false, false, true,  false, true,  false, false, false, false, false],
      snare:       [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      hihatClosed: [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true],
      hihatOpen:   [false, false, false, false, false, false, true,  false, false, false, false, false, false, false, true,  false],
      clap:        [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      sub808:      [true,  false, false, true,  false, false, false, false, true,  false, false, false, false, true,  false, false],
      perc:        [false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false, false],
    },
    bassNotes: [
      { id: 'b1', pitch: 'C2', step: 0, durationSteps: 4, velocity: 0.95 },
      { id: 'b2', pitch: 'Eb2', step: 8, durationSteps: 4, velocity: 0.9 },
      { id: 'b3', pitch: 'G1', step: 12, durationSteps: 4, velocity: 0.85 },
    ],
    pianoNotes: [
      // Cm chord (C4, Eb4, G4)
      { id: 'p1', pitch: 'C4', step: 0, durationSteps: 6, velocity: 0.8 },
      { id: 'p2', pitch: 'Eb4', step: 0, durationSteps: 6, velocity: 0.75 },
      { id: 'p3', pitch: 'G4', step: 0, durationSteps: 6, velocity: 0.75 },
      // Eb chord (Eb4, G4, Bb4)
      { id: 'p4', pitch: 'Eb4', step: 8, durationSteps: 6, velocity: 0.8 },
      { id: 'p5', pitch: 'G4', step: 8, durationSteps: 6, velocity: 0.75 },
      { id: 'p6', pitch: 'Bb4', step: 8, durationSteps: 6, velocity: 0.75 },
    ],
  },
  {
    id: 'lofi-chillhop',
    name: 'Lo-Fi Chillhop Mellow',
    genre: 'lo-fi',
    bpm: 82,
    key: 'F',
    scale: 'major',
    description: 'Laid-back boom-bap swing, dusty rimshot, open hats, and warm Rhodes jazz major 7th chords.',
    drumSteps: {
      kick:        [true,  false, false, false, false, false, true,  false, false, false, true,  false, false, false, false, false],
      snare:       [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      hihatClosed: [true,  false, true,  false, true,  false, true,  true,  true,  false, true,  false, true,  false, true,  false],
      hihatOpen:   [false, false, false, false, false, false, false, false, false, false, false, false, false, false, true,  false],
      clap:        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      sub808:      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      perc:        [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, true],
    },
    bassNotes: [
      { id: 'b1', pitch: 'F2', step: 0, durationSteps: 6, velocity: 0.7 },
      { id: 'b2', pitch: 'D2', step: 6, durationSteps: 4, velocity: 0.65 },
      { id: 'b3', pitch: 'Bb1', step: 10, durationSteps: 6, velocity: 0.7 },
    ],
    pianoNotes: [
      // Fmaj7 (F3, A3, C4, E4)
      { id: 'p1', pitch: 'F3', step: 0, durationSteps: 6, velocity: 0.7 },
      { id: 'p2', pitch: 'A3', step: 0, durationSteps: 6, velocity: 0.65 },
      { id: 'p3', pitch: 'C4', step: 0, durationSteps: 6, velocity: 0.65 },
      { id: 'p4', pitch: 'E4', step: 0, durationSteps: 6, velocity: 0.6 },
      // Dm7 (D3, F3, A3, C4)
      { id: 'p5', pitch: 'D3', step: 8, durationSteps: 6, velocity: 0.7 },
      { id: 'p6', pitch: 'F3', step: 8, durationSteps: 6, velocity: 0.65 },
      { id: 'p7', pitch: 'A3', step: 8, durationSteps: 6, velocity: 0.65 },
      { id: 'p8', pitch: 'C4', step: 8, durationSteps: 6, velocity: 0.6 },
    ],
  },
  {
    id: 'house-club-groove',
    name: 'House 4-on-the-Floor Club',
    genre: 'electronic',
    bpm: 126,
    key: 'A',
    scale: 'minor',
    description: 'Relentless four-on-the-floor kick, offbeat open hats, bouncy slap bassline, and uplifting piano stabs.',
    drumSteps: {
      kick:        [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
      snare:       [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      hihatClosed: [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false],
      hihatOpen:   [false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false],
      clap:        [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      sub808:      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      perc:        [false, false, false, true,  false, false, true,  false, false, false, false, true,  false, false, true,  false],
    },
    bassNotes: [
      { id: 'b1', pitch: 'A1', step: 2, durationSteps: 2, velocity: 0.85 },
      { id: 'b2', pitch: 'A1', step: 6, durationSteps: 2, velocity: 0.85 },
      { id: 'b3', pitch: 'C2', step: 10, durationSteps: 2, velocity: 0.85 },
      { id: 'b4', pitch: 'D2', step: 14, durationSteps: 2, velocity: 0.85 },
    ],
    pianoNotes: [
      // Am stab
      { id: 'p1', pitch: 'A3', step: 0, durationSteps: 2, velocity: 0.85 },
      { id: 'p2', pitch: 'C4', step: 0, durationSteps: 2, velocity: 0.85 },
      { id: 'p3', pitch: 'E4', step: 0, durationSteps: 2, velocity: 0.85 },
      // F stab
      { id: 'p4', pitch: 'F3', step: 8, durationSteps: 2, velocity: 0.85 },
      { id: 'p5', pitch: 'A3', step: 8, durationSteps: 2, velocity: 0.85 },
      { id: 'p6', pitch: 'C4', step: 8, durationSteps: 2, velocity: 0.85 },
    ],
  },
  {
    id: 'phonk-drift',
    name: 'Phonk Aggressive Drift',
    genre: 'phonk',
    bpm: 130,
    key: 'G',
    scale: 'minor',
    description: 'Heavily saturated 808 sub, syncopated cowbell tone, fast clicking hats, and sinister minor melodies.',
    drumSteps: {
      kick:        [true,  false, false, false, true,  false, false, false, true,  false, true,  false, true,  false, false, false],
      snare:       [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      hihatClosed: [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true],
      hihatOpen:   [false, false, false, false, false, false, true,  false, false, false, false, false, false, false, true,  false],
      clap:        [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      sub808:      [true,  false, false, true,  false, false, true,  false, true,  false, false, false, false, true,  false, false],
      perc:        [false, false, true,  false, false, false, false, false, false, false, true,  false, false, false, false, false],
    },
    bassNotes: [
      { id: 'b1', pitch: 'G1', step: 0, durationSteps: 4, velocity: 0.95 },
      { id: 'b2', pitch: 'Bb1', step: 6, durationSteps: 4, velocity: 0.9 },
      { id: 'b3', pitch: 'D2', step: 10, durationSteps: 4, velocity: 0.9 },
    ],
    pianoNotes: [
      // Sinister Gm pluck
      { id: 'p1', pitch: 'G4', step: 0, durationSteps: 2, velocity: 0.85 },
      { id: 'p2', pitch: 'Bb4', step: 3, durationSteps: 2, velocity: 0.85 },
      { id: 'p3', pitch: 'D5', step: 6, durationSteps: 2, velocity: 0.85 },
      { id: 'p4', pitch: 'C5', step: 10, durationSteps: 2, velocity: 0.8 },
      { id: 'p5', pitch: 'Bb4', step: 13, durationSteps: 2, velocity: 0.8 },
    ],
  },
  {
    id: 'pop-acoustic-anthem',
    name: 'Pop Acoustic & Rock Drive',
    genre: 'pop',
    bpm: 118,
    key: 'C',
    scale: 'major',
    description: 'Steady acoustic kick, crisp snare crack, ghost hi-hats, bright piano chords (C - G - Am - F), and melodic bass.',
    drumSteps: {
      kick:        [true,  false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false],
      snare:       [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      hihatClosed: [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false],
      hihatOpen:   [false, false, false, false, false, false, false, false, false, false, false, false, false, false, true,  false],
      clap:        [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      sub808:      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      perc:        [false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false, true],
    },
    bassNotes: [
      { id: 'b1', pitch: 'C2', step: 0, durationSteps: 4, velocity: 0.8 },
      { id: 'b2', pitch: 'G1', step: 4, durationSteps: 4, velocity: 0.8 },
      { id: 'b3', pitch: 'A1', step: 8, durationSteps: 4, velocity: 0.8 },
      { id: 'b4', pitch: 'F1', step: 12, durationSteps: 4, velocity: 0.8 },
    ],
    pianoNotes: [
      // C Major (C4, E4, G4)
      { id: 'p1', pitch: 'C4', step: 0, durationSteps: 3, velocity: 0.8 },
      { id: 'p2', pitch: 'E4', step: 0, durationSteps: 3, velocity: 0.75 },
      { id: 'p3', pitch: 'G4', step: 0, durationSteps: 3, velocity: 0.75 },
      // G Major (B3, D4, G4)
      { id: 'p4', pitch: 'B3', step: 4, durationSteps: 3, velocity: 0.8 },
      { id: 'p5', pitch: 'D4', step: 4, durationSteps: 3, velocity: 0.75 },
      { id: 'p6', pitch: 'G4', step: 4, durationSteps: 3, velocity: 0.75 },
      // A Minor (A3, C4, E4)
      { id: 'p7', pitch: 'A3', step: 8, durationSteps: 3, velocity: 0.8 },
      { id: 'p8', pitch: 'C4', step: 8, durationSteps: 3, velocity: 0.75 },
      { id: 'p9', pitch: 'E4', step: 8, durationSteps: 3, velocity: 0.75 },
      // F Major (F3, A3, C4)
      { id: 'p10', pitch: 'F3', step: 12, durationSteps: 3, velocity: 0.8 },
      { id: 'p11', pitch: 'A3', step: 12, durationSteps: 3, velocity: 0.75 },
      { id: 'p12', pitch: 'C4', step: 12, durationSteps: 3, velocity: 0.75 },
    ],
  },
  {
    id: 'reggaeton-dembow',
    name: 'Reggaeton Latin Dembow',
    genre: 'reggaeton',
    bpm: 96,
    key: 'D',
    scale: 'minor',
    description: 'Iconic Dembow syncopated snare bounce on 3:16 & 7:16, heavy kick on every beat, and deep sub.',
    drumSteps: {
      kick:        [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
      snare:       [false, false, false, true,  false, false, true,  false, false, false, false, true,  false, false, true,  false],
      hihatClosed: [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false],
      hihatOpen:   [false, false, false, false, false, false, false, false, false, false, false, false, false, false, true,  false],
      clap:        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      sub808:      [true,  false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false],
      perc:        [false, false, false, true,  false, false, true,  false, false, false, false, true,  false, false, true,  false],
    },
    bassNotes: [
      { id: 'b1', pitch: 'D2', step: 0, durationSteps: 6, velocity: 0.9 },
      { id: 'b2', pitch: 'Bb1', step: 8, durationSteps: 6, velocity: 0.9 },
    ],
    pianoNotes: [
      // Dm chord
      { id: 'p1', pitch: 'D4', step: 0, durationSteps: 4, velocity: 0.8 },
      { id: 'p2', pitch: 'F4', step: 0, durationSteps: 4, velocity: 0.75 },
      { id: 'p3', pitch: 'A4', step: 0, durationSteps: 4, velocity: 0.75 },
      // Bb chord
      { id: 'p4', pitch: 'Bb3', step: 8, durationSteps: 4, velocity: 0.8 },
      { id: 'p5', pitch: 'D4', step: 8, durationSteps: 4, velocity: 0.75 },
      { id: 'p6', pitch: 'F4', step: 8, durationSteps: 4, velocity: 0.75 },
    ],
  },
  {
    id: 'indian-bhangra-rhythm',
    name: 'Indian Bhangra & Dholak Groove',
    genre: 'indian',
    bpm: 104,
    key: 'C',
    scale: 'major',
    description: 'High-energy festive Indian groove with driving dholak accents, hand claps, and bright melodic synth lines.',
    drumSteps: {
      kick:        [true,  false, false, false, false, false, true,  false, true,  false, false, false, false, false, true,  false],
      snare:       [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      hihatClosed: [true,  false, true,  true,  true,  false, true,  true,  true,  false, true,  true,  true,  false, true,  true],
      hihatOpen:   [false, false, false, false, false, false, true,  false, false, false, false, false, false, false, true,  false],
      clap:        [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      sub808:      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      perc:        [true,  true,  false, true,  false, true,  true,  false, true,  true,  false, true,  false, true,  true,  false],
    },
    bassNotes: [
      { id: 'b1', pitch: 'C2', step: 0, durationSteps: 4, velocity: 0.85 },
      { id: 'b2', pitch: 'G1', step: 6, durationSteps: 4, velocity: 0.85 },
      { id: 'b3', pitch: 'F1', step: 10, durationSteps: 4, velocity: 0.85 },
    ],
    pianoNotes: [
      // Melodic festive hook
      { id: 'p1', pitch: 'C4', step: 0, durationSteps: 2, velocity: 0.85 },
      { id: 'p2', pitch: 'E4', step: 2, durationSteps: 2, velocity: 0.85 },
      { id: 'p3', pitch: 'G4', step: 4, durationSteps: 2, velocity: 0.9 },
      { id: 'p4', pitch: 'C5', step: 6, durationSteps: 4, velocity: 0.95 },
      { id: 'p5', pitch: 'G4', step: 10, durationSteps: 2, velocity: 0.85 },
      { id: 'p6', pitch: 'F4', step: 12, durationSteps: 2, velocity: 0.8 },
      { id: 'p7', pitch: 'E4', step: 14, durationSteps: 2, velocity: 0.8 },
    ],
  },
];

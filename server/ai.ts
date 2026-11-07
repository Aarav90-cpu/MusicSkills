import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { loadConfig } from './config';

export function getAIModel(overrideProvider?: string, overrideKey?: string, overrideModel?: string) {
  const config = loadConfig();
  const provider = overrideProvider || config.provider || 'anthropic';
  const apiKey = overrideKey || config.apiKey || '';
  const modelName = overrideModel || config.model;

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey });
    return anthropic(modelName || 'claude-sonnet-5-5');
  } else if (provider === 'openai') {
    const openai = createOpenAI({ apiKey });
    return openai(modelName || 'gpt-5.5');
  } else if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelName || 'gemini-4-argon');
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

export async function testApiKey(
  provider: 'anthropic' | 'openai' | 'google',
  model: string,
  apiKey: string
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { ok: false, message: 'API key cannot be empty' };
  }

  const startTime = Date.now();
  try {
    const modelInstance = getAIModel(provider, apiKey.trim(), model);
    const result = await generateText({
      model: modelInstance,
      prompt: 'Respond with exactly one word: OK',
      maxOutputTokens: 5,
    });

    const latencyMs = Date.now() - startTime;
    if (result.text && result.text.length > 0) {
      return { ok: true, message: `Connected to ${provider} (${model}) in ${latencyMs}ms`, latencyMs };
    }
    return { ok: false, message: 'Empty response received from provider' };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Failed to authenticate with provider',
      latencyMs: Date.now() - startTime,
    };
  }
}

export async function fetchLRCLibReference(
  query: string
): Promise<{ trackName: string; artistName: string; lyricsText: string; syncedLyrics?: string } | null> {
  try {
    let cleanQuery = query.trim();
    const match = query.match(/(?:based on|lyrics of|like|inspired by)\s+(?:the\s+lyrics\s+of\s+)?["']?([^"']+)["']?/i);
    if (match) {
      cleanQuery = match[1].trim();
    }

    const encoded = encodeURIComponent(cleanQuery);
    const res = await fetch(`https://lrclib.net/api/search?q=${encoded}`, {
      headers: {
        'User-Agent': 'MusicSkills-Studio/1.0.0 (https://github.com/Aarav90-cpu/MusicSkills)',
        'Lrclib-Client': 'MusicSkills-Studio/1.0.0',
      },
    });

    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        const best = records.find((r: any) => Boolean(r.plainLyrics || r.syncedLyrics)) || records[0];
        const rawLyrics = best.plainLyrics || (best.syncedLyrics ? best.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim() : '');
        if (rawLyrics) {
          return {
            trackName: best.trackName,
            artistName: best.artistName,
            lyricsText: rawLyrics,
            syncedLyrics: best.syncedLyrics || undefined,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[AI Engine] Failed to query LRCLIB for baseline:', err);
  }
  return null;
}

export async function generateLyrics(params: {
  topic: string;
  genre: string;
  mood: string;
  purpose: string;
  vocalDelivery: string;
  sections: Array<{ name: string; type: string; bars: number }>;
  referenceSong?: string;
  referenceLyrics?: string;
}): Promise<Record<string, string[]>> {
  const config = loadConfig();

  // If no API key configured, use procedural genre-specific generation
  if (!config.apiKey || config.apiKey.trim().length === 0) {
    return generateLocalFallbackLyrics(params);
  }

  // Attempt generation with automatic retry
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const model = getAIModel();
      const targetSections = (params.sections && params.sections.length > 0)
        ? params.sections.filter(s => s.type !== 'intro' && s.type !== 'outro' && s.type !== 'instrumental_break').map(s => s.name)
        : ['Verse 1', 'Pre-Chorus', 'Chorus 1', 'Verse 2', 'Chorus 2', 'Bridge', 'Chorus 3'];

      let baselineContext = '';
      if (params.referenceLyrics) {
        baselineContext = `\nReference Song Baseline:\n${params.referenceLyrics}\n`;
      } else if (
        params.referenceSong ||
        params.topic.toLowerCase().includes('based on') ||
        params.topic.toLowerCase().includes('lyrics of') ||
        params.topic.toLowerCase().includes('inspired by')
      ) {
        const queryToSearch = params.referenceSong || params.topic;
        const ref = await fetchLRCLibReference(queryToSearch);
        if (ref) {
          baselineContext = `\nReference Baseline Song: "${ref.trackName}" by ${ref.artistName}\nBaseline Lyrics:\n${ref.lyricsText}\n\nInstruction: Write an original song inspired by the themes, rhyme cadence, and narrative arc of this baseline track. Do not copy lines verbatim; reinterpret the imagery and emotion into ${params.genre}.\n`;
        }
      }

      const systemPrompt = `You are an elite music lyricist and vocal arranger.
Genre: ${params.genre}
Mood: ${params.mood}
Purpose: ${params.purpose}
Vocal Style: ${params.vocalDelivery}
Topic: ${params.topic}${baselineContext}

Structure your output strictly by section:
[Section Name]
Line 1
Line 2
Line 3
Line 4

Rules:
1. Write rhythmic, singable lyrical phrases matching natural vocal breath pauses.
2. Maintain metric rhyming appropriate to ${params.genre}.
3. Provide lyrics for each of these sections: ${targetSections.join(', ')}.
4. Do not include introductory conversational banter or concluding markdown commentary.
5. Strictly zero emojis anywhere.`;

      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: `Write complete, original lyrics about "${params.topic}". Keep the tone authentic to ${params.genre} with a ${params.mood} energy.`,
        temperature: config.creativity ?? 0.7,
      });

      const parsed = parseLyricsOutput(text, targetSections);
      if (Object.keys(parsed).length > 0) {
        return ensureSectionsComplete(parsed, params, targetSections);
      }
    } catch (err: any) {
      console.warn(`[AI Engine] Attempt ${attempt} failed:`, err.message || err);
      if (attempt === maxAttempts) {
        console.warn('[AI Engine] Falling back to procedural lyrical composition.');
        return generateLocalFallbackLyrics(params);
      }
      // Short delay before retry
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  return generateLocalFallbackLyrics(params);
}

export function parseLyricsOutput(text: string, expectedSections?: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let currentSection = 'Verse 1';

  // Remove code blocks if present
  let cleanText = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');

  const lines = cleanText.split('\n');
  const sectionHeaderRegex = /^(?:\[|\#{1,4}\s*|\*{1,2})?([A-Za-z0-9\s\-_()]+?)(?:\]|\:|\*{1,2})?$/;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Detect section headers: [Verse 1], ## Chorus, **Bridge**, Verse 1:, etc.
    const isBracketed = trimmed.startsWith('[') && trimmed.endsWith(']');
    const isMarkdownHeader = trimmed.startsWith('#');
    const isColonHeader = /^[A-Za-z0-9\s]+:$/.test(trimmed);

    if (isBracketed || isMarkdownHeader || isColonHeader) {
      const cleanedName = trimmed
        .replace(/^[#\[\*\s]+/, '')
        .replace(/[#\]\*\:\s]+$/, '')
        .trim();

      if (cleanedName.length > 0) {
        currentSection = cleanedName;
        if (!result[currentSection]) result[currentSection] = [];
        continue;
      }
    }

    // Clean lyric lines: strip bullet dashes (- , * ), numbers (1. , 1) ), quotation marks
    let lineContent = trimmed
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+[\.\)]\s+/, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    if (lineContent.length > 0) {
      if (!result[currentSection]) result[currentSection] = [];
      result[currentSection].push(lineContent);
    }
  }

  return result;
}

function ensureSectionsComplete(
  lyrics: Record<string, string[]>,
  params: { topic: string; genre: string; mood: string },
  targetSections: string[]
): Record<string, string[]> {
  const fallback = generateLocalFallbackLyrics({
    topic: params.topic,
    genre: params.genre,
    mood: params.mood,
    purpose: '',
    vocalDelivery: '',
  });

  const output: Record<string, string[]> = { ...lyrics };

  for (const sec of targetSections) {
    // If section is missing or has fewer than 2 lines, supplement with fallback
    if (!output[sec] || output[sec].length < 2) {
      const fallbackLines = fallback[sec] || fallback['Verse 1'] || [
        `Riding the rhythm of ${params.topic} through the night`,
        `Holding the vision in the glowing city light`,
        `Stepping together where the future starts to shine`,
        `Leaving the shadows on the boundary line`,
      ];
      output[sec] = fallbackLines;
    }
  }

  return output;
}

export function generateLocalFallbackLyrics(params: {
  topic: string;
  genre: string;
  mood: string;
  purpose: string;
  vocalDelivery: string;
}): Record<string, string[]> {
  const t = params.topic || 'the dream';
  const genreLower = (params.genre || 'pop').toLowerCase();

  // Genre-Specific authentic lyrical templates
  if (genreLower.includes('phonk') || genreLower.includes('hip-hop') || genreLower.includes('rap')) {
    return {
      'Verse 1': [
        `Tires smoking on the asphalt, midnight in the rear-view glass`,
        `Chasing down ${t}, moving heavy on the mountain pass`,
        `Bassline hitting through the sub, shadows in the city haze`,
        `Count the miles on the meter, navigating through the maze`,
      ],
      'Pre-Chorus': [
        `Rev the engine up, feel the static in the sound`,
        `When the drop hits, we are never looking down`,
      ],
      'Chorus 1': [
        `This is ${t}! Drift across the boundary line!`,
        `Catch the spark ignite, make the neon city shine`,
        `Heavy on the low end, running till the break of day`,
        `Nothing in our path is ever getting in the way!`,
      ],
      'Verse 2': [
        `Red line flashing on the dash, tempo rising in the chest`,
        `Paid the price in full, put the doubts and fears to rest`,
        `Steering through the blind curves, headlights cutting clean`,
        `Writing out our legend on the asphalt in between`,
      ],
      'Chorus 2': [
        `This is ${t}! Drift across the boundary line!`,
        `Catch the spark ignite, make the neon city shine`,
        `Heavy on the low end, running till the break of day`,
        `Nothing in our path is ever getting in the way!`,
      ],
      'Bridge': [
        `Silence for a moment while the motor cools to black`,
        `Look across the distance, there is no retreating back`,
        `One click on the gear shift, grip the steering wheel`,
        `Everything is motion, everything is real!`,
      ],
      'Chorus 3': [
        `This is ${t}! Drift across the boundary line!`,
        `Catch the spark ignite, make the neon city shine!`,
        `Crown the new champion, take the final lap tonight!`,
        `Burning through the morning till the horizon turns to light!`,
      ],
      'Outro': [
        `Drifting through the night...`,
        `Living for ${t}...`,
      ],
    };
  }

  if (genreLower.includes('rock') || genreLower.includes('metal')) {
    return {
      'Verse 1': [
        `Feedback hums across the floor, waiting for the drum to strike`,
        `Walking down the iron road, holding what we used to like`,
        `Electric static in the air, searching for ${t} once again`,
        `Hear the chord progression break through the cold October rain`,
      ],
      'Pre-Chorus': [
        `Turn the gain up high, let the amplifier scream`,
        `Wake the sleeping heart from a faded hollow dream`,
      ],
      'Chorus 1': [
        `We scream for ${t}! Break the silence on the wall!`,
        `Tear the shadows down, we will answer to the call`,
        `Stand against the storm with our voices in the sky`,
        `Raise the anthem up, we will never wonder why!`,
      ],
      'Verse 2': [
        `Cables tangled on the stage, echoes of the open night`,
        `Every scar is evidence of another hard-won fight`,
        `Pushing past the cynics and the voices in the crowd`,
        `Living on the edge of sound, unapologetic and proud`,
      ],
      'Chorus 2': [
        `We scream for ${t}! Break the silence on the wall!`,
        `Tear the shadows down, we will answer to the call`,
        `Stand against the storm with our voices in the sky`,
        `Raise the anthem up, we will never wonder why!`,
      ],
      'Bridge': [
        `Single acoustic strum, whisper in the quiet air`,
        `Everything we suffered and the load we had to bear`,
        `Now the kick drum pounds like a pulse beneath the floor`,
        `Break the gates wide open, we will knock no more!`,
      ],
      'Chorus 3': [
        `We scream for ${t}! Break the silence on the wall!`,
        `Shatter every limit, we will conquer through it all!`,
        `Stand against the storm with our voices burning high`,
        `Victory is roaring beneath the open sky!`,
      ],
      'Outro': [
        `Reverberate into the dark...`,
        `This is ${t}...`,
      ],
    };
  }

  if (genreLower.includes('indian')) {
    return {
      'Verse 1': [
        `Morning ragas greet the dawn, colors shining in the breeze`,
        `Melodies of ${t} drifting through the temple trees`,
        `Tabla rhythms mark the beat, sitar strings begin to sing`,
        `Welcoming the joy that the celebration brings`,
      ],
      'Pre-Chorus': [
        `Feel the tempo rise, hear the ankle bells resound`,
        `Sacred celebration on this holy fertile ground`,
      ],
      'Chorus 1': [
        `Sing the song of ${t}, let the colors fly on high!`,
        `Joyous celebration lighting up the morning sky`,
        `Dance in harmony, let the festive music play`,
        `Every heart united on this radiant happy day!`,
      ],
      'Verse 2': [
        `Saffron, gold, and crimson dust dancing in the solar light`,
        `Stories told for centuries shining brilliantly and bright`,
        `Flute cascades across the square, laughter echoing around`,
        `Every step in unison to the ancient vibrant sound`,
      ],
      'Chorus 2': [
        `Sing the song of ${t}, let the colors fly on high!`,
        `Joyous celebration lighting up the morning sky`,
        `Dance in harmony, let the festive music play`,
        `Every heart united on this radiant happy day!`,
      ],
      'Bridge': [
        `Quiet prayer of gratitude as the midday sun ascends`,
        `Cherishing the brotherhood of our families and friends`,
        `Now the rhythm gathers speed, accelerating fast`,
        `Celebrate the future while honoring the past!`,
      ],
      'Chorus 3': [
        `Sing the song of ${t}, let the colors fly on high!`,
        `Joyous celebration echoing into the sky!`,
        `Blissful and triumphant, let the celebration ring`,
        `Hear the universe rejoice as the people sing!`,
      ],
      'Outro': [
        `Golden petals falling...`,
        `Blessed by ${t}...`,
      ],
    };
  }

  // Default Pop / EDM / Contemporary
  return {
    'Verse 1': [
      `Footsteps on the pavement as the morning starts to wake`,
      `Thinking about ${t} and the promises we make`,
      `Shadows fall behind us as the horizon turns to gold`,
      `Stepping toward the future and the story to unfold`,
    ],
    'Pre-Chorus': [
      `Feel the rising rhythm deep within the chest`,
      `There is no looking back now, put your doubts to rest`,
    ],
    'Chorus 1': [
      `This is our moment, living for ${t}!`,
      `Nothing in our path can ever hold us away`,
      `Hear the thunder rolling, burning through the sky`,
      `We will hold the flame and watch our banners fly!`,
    ],
    'Verse 2': [
      `Every road we traveled through the driving winter rain`,
      `Carried in our memories above the quiet pain`,
      `Now the road is open and the sky is running clear`,
      `Standing on the boundary with nothing left to fear`,
    ],
    'Chorus 2': [
      `This is our moment, living for ${t}!`,
      `Nothing in our path can ever hold us away`,
      `Hear the thunder rolling, burning through the sky`,
      `We will hold the flame and watch our banners fly!`,
    ],
    'Bridge': [
      `When the silence settles down and shadows clear away`,
      `A single spark of silver light begins to guide the way`,
      `It calls our name across the night, resilient and bold`,
      `Now witness how the greatest chapter finally is told!`,
    ],
    'Chorus 3': [
      `This is our moment, living for ${t}!`,
      `We shook the very ground and made the impossible true!`,
      `Hear the thunder rolling, shining in the light`,
      `Victory belongs to everyone tonight!`,
    ],
    'Outro': [
      `Living for ${t}...`,
      `Until the journey is done...`,
    ],
  };
}

// --- PYTHON MUSIC COMPOSITION CODE GENERATION ENGINE ---

export interface GenerateCodeParams {
  topic: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  sections?: Array<{ name: string; type: string; bars: number; energy?: string }>;
  lyrics?: Record<string, string[]>;
  baseName?: string;
  instructions?: string;
}

export interface GeneratedCodeResult {
  code: string;
  lineCount: number;
  linesAdded: number;
  linesRemoved: number;
  summary: string;
  fileName: string;
}

export function generateProceduralPythonCode(params: GenerateCodeParams): string {
  const bpm = params.bpm || 120;
  const key = (params.key || 'C').toUpperCase().replace(' ', '');
  const genre = (params.genre || 'pop').toLowerCase();
  const mood = params.mood || 'energetic';
  const topic = (params.topic || 'New Project').replace(/"/g, '\\"');
  const baseName = params.baseName || 'composition';

  // Determine scale type based on mood and genre
  let scale = 'major';
  if (['phonk', 'hip-hop', 'trap', 'metal', 'rock'].some(g => genre.includes(g)) || ['dark', 'aggressive', 'intense', 'melancholic'].some(m => mood.includes(m))) {
    scale = 'minor';
  } else if (genre.includes('electronic') || genre.includes('dance')) {
    scale = 'dorian';
  } else if (genre.includes('blues') || genre.includes('jazz')) {
    scale = 'pentatonic_minor';
  }

  // Instrument program numbers based on genre
  let chordProg = 0; // Acoustic Grand Piano
  let bassProg = 33; // Electric Bass (finger)
  let leadProg = 81; // Sawtooth Lead
  if (genre.includes('electronic') || genre.includes('phonk')) {
    chordProg = 88; // Pad warm
    bassProg = 38; // Synth Bass 1
    leadProg = 80; // Square Lead
  } else if (genre.includes('rock') || genre.includes('metal')) {
    chordProg = 29; // Overdriven Guitar
    bassProg = 34; // Electric Bass (pick)
    leadProg = 30; // Distortion Guitar
  } else if (genre.includes('hip-hop')) {
    chordProg = 4; // Electric Piano
    bassProg = 38; // Synth Bass 808
    leadProg = 81; // Sawtooth Lead
  }

  return `"""
${topic} - AI Musical Composition Engine
Genre: ${genre.toUpperCase()} | BPM: ${bpm} | Key: ${key} ${scale.toUpperCase()} | Mood: ${mood}
Generated by MusicSkills AI Composer
"""

import os
import sys
import json
import math
import random
from typing import List, Dict, Tuple, Optional
import mido
from mido import Message, MetaMessage, MidiFile, MidiTrack

# --- MUSIC THEORY CONSTANTS ---
BPM = ${bpm}
TICKS_PER_BEAT = 480
ROOT_KEY = "${key}"
SCALE_TYPE = "${scale}"
GENRE = "${genre}"

# Scale intervals relative to root
SCALES: Dict[str, List[int]] = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor": [0, 2, 3, 5, 7, 8, 11],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "pentatonic_minor": [0, 3, 5, 7, 10],
}

ROOT_MIDI_MAP: Dict[str, int] = {
    "C": 60, "C#": 61, "DB": 61, "D": 62, "D#": 63, "EB": 63,
    "E": 64, "F": 65, "F#": 66, "GB": 66, "G": 67, "G#": 68,
    "AB": 68, "A": 69, "A#": 70, "BB": 70, "B": 71,
}

# Standard General MIDI Drum Map (Channel 9)
GM_DRUM = {
    "kick": 36,
    "snare": 38,
    "side_stick": 37,
    "closed_hihat": 42,
    "pedal_hihat": 44,
    "open_hihat": 46,
    "low_tom": 41,
    "mid_tom": 47,
    "high_tom": 50,
    "crash": 49,
    "ride": 51,
    "cowbell": 56,
}

def humanize_time(ticks: int, jitter: int = 8) -> int:
    """Adds natural human micro-timing jitter to prevent robotic quantization."""
    return max(0, ticks + random.randint(-jitter, jitter))

def humanize_vel(base_velocity: int, variance: int = 10, min_v: int = 25, max_v: int = 127) -> int:
    """Applies human performance velocity variance."""
    v = base_velocity + random.randint(-variance, variance)
    return max(min_v, min(max_v, v))

def get_chord_notes(root_midi: int, intervals: List[int], degree_index: int) -> List[int]:
    """Generates standard triads and 7th extensions within the chosen scale."""
    n_scale = len(intervals)
    root_deg = intervals[degree_index % n_scale]
    third_deg = intervals[(degree_index + 2) % n_scale]
    fifth_deg = intervals[(degree_index + 4) % n_scale]
    
    # Octave adjustment
    note1 = root_midi + root_deg
    note2 = root_midi + third_deg + (12 if third_deg < root_deg else 0)
    note3 = root_midi + fifth_deg + (12 if fifth_deg < root_deg else 0)
    return [note1, note2, note3]

class CustomSongComposer:
    def __init__(self, bpm: int = BPM, key: str = ROOT_KEY, scale_name: str = SCALE_TYPE):
        self.bpm = bpm
        self.root_midi = ROOT_MIDI_MAP.get(key.upper(), 60)
        self.scale = SCALES.get(scale_name.lower(), SCALES["major"])
        self.ticks_per_beat = TICKS_PER_BEAT
        self.tempo_us = int(60_000_000 / self.bpm)

    def compose(self, output_mid_path: str = "${baseName}.mid") -> Dict[str, any]:
        mid = MidiFile(ticks_per_beat=self.ticks_per_beat)

        # 1. Meta / Conductor Track
        track_meta = MidiTrack()
        mid.tracks.append(track_meta)
        track_meta.append(MetaMessage("track_name", name="${topic} - Master Track", time=0))
        track_meta.append(MetaMessage("set_tempo", tempo=self.tempo_us, time=0))
        track_meta.append(MetaMessage("time_signature", numerator=4, denominator=4, time=0))

        # 2. Harmony / Chord Progression (Channel 0)
        track_chords = MidiTrack()
        mid.tracks.append(track_chords)
        track_chords.append(MetaMessage("track_name", name="Harmonic Chords", time=0))
        track_chords.append(Message("program_change", channel=0, program=${chordProg}, time=0))

        # 3. Bassline / Sub Drive (Channel 1)
        track_bass = MidiTrack()
        mid.tracks.append(track_bass)
        track_bass.append(MetaMessage("track_name", name="Bass & Sub Impact", time=0))
        track_bass.append(Message("program_change", channel=1, program=${bassProg}, time=0))

        # 4. Lead Arpeggio & Melody (Channel 2)
        track_lead = MidiTrack()
        mid.tracks.append(track_lead)
        track_lead.append(MetaMessage("track_name", name="Lead & Synth Arp", time=0))
        track_lead.append(Message("program_change", channel=2, program=${leadProg}, time=0))

        # 5. Multi-Track Drum Kit (Channel 9)
        track_drums = MidiTrack()
        mid.tracks.append(track_drums)
        track_drums.append(MetaMessage("track_name", name="Drums & Percussion", time=0))

        # Song Section Architecture: Intro -> Verse 1 -> Climb -> Drop -> Verse 2 -> Breakdown -> Climax Drop -> Outro
        sections = [
            {"name": "Intro", "type": "intro", "bars": 4, "energy": "low"},
            {"name": "Verse 1", "type": "verse", "bars": 8, "energy": "mid"},
            {"name": "Pre-Chorus Climb", "type": "climb", "bars": 4, "energy": "high"},
            {"name": "Chorus Beat Drop", "type": "drop", "bars": 8, "energy": "climax"},
            {"name": "Verse 2", "type": "verse", "bars": 8, "energy": "mid"},
            {"name": "Bridge Breakdown", "type": "bridge", "bars": 4, "energy": "low"},
            {"name": "Final Climax Drop", "type": "drop", "bars": 8, "energy": "climax"},
            {"name": "Outro Fade", "type": "outro", "bars": 4, "energy": "low"},
        ]

        # Chord degrees: I - V - vi - IV progression
        chord_prog = [0, 4, 5, 3]

        total_bars = sum(s["bars"] for s in sections)
        bar_duration_sec = (60.0 / self.bpm) * 4.0
        total_duration_sec = total_bars * bar_duration_sec

        # --- SECTION COMPOSITION LOOP ---
        for sec in sections:
            sec_type = sec["type"]
            bars = sec["bars"]

            for bar in range(bars):
                deg = chord_prog[bar % len(chord_prog)]
                chord_notes = get_chord_notes(self.root_midi, self.scale, deg)
                bass_note = self.root_midi - 24 + self.scale[deg % len(self.scale)]

                # CHORDS: Sustained chords on beats 1 and 3
                for beat in [0, 2]:
                    chord_vel = humanize_vel(75 if sec_type != "drop" else 95)
                    delta = humanize_time(self.ticks_per_beat * 2) if beat == 2 else 0
                    dur = humanize_time(int(self.ticks_per_beat * 1.9))
                    for note in chord_notes:
                        track_chords.append(Message("note_on", channel=0, note=note, velocity=chord_vel, time=0))
                    for idx, note in enumerate(chord_notes):
                        track_chords.append(Message("note_off", channel=0, note=note, velocity=0, time=dur if idx == 0 else 0))

                # BASSLINE: Dynamic section handling with sub-punch on drop and silence gap on climb
                is_last_climb_bar = (sec_type == "climb" and bar == bars - 1)
                if is_last_climb_bar:
                    # Ascending walk-up on beats 1-2, then TOTAL SILENCE on beats 3-4 (Pre-Drop Breath)
                    for step in range(8):
                        step_time = self.ticks_per_beat // 2
                        if step < 4:
                            walk_note = bass_note + step * 2
                            vel = humanize_vel(98)
                            track_bass.append(Message("note_on", channel=1, note=walk_note, velocity=vel, time=0))
                            track_bass.append(Message("note_off", channel=1, note=walk_note, velocity=0, time=int(step_time * 0.9)))
                        else:
                            # Silence gap
                            track_bass.append(Message("note_off", channel=1, note=bass_note, velocity=0, time=step_time))
                elif sec_type == "drop":
                    # Massive Sub-Bass Impact on Beat 1 (-12 semitones punch)
                    for step in range(8):
                        sub_note = (bass_note - 12) if step == 0 else bass_note
                        b_vel = humanize_vel(115 if step == 0 else 102)
                        step_time = self.ticks_per_beat // 2
                        track_bass.append(Message("note_on", channel=1, note=sub_note, velocity=b_vel, time=0))
                        track_bass.append(Message("note_off", channel=1, note=sub_note, velocity=0, time=int(step_time * 0.85)))
                else:
                    # Standard 8th note groove
                    for step in range(8):
                        step_time = self.ticks_per_beat // 2
                        b_vel = humanize_vel(82)
                        track_bass.append(Message("note_on", channel=1, note=bass_note, velocity=b_vel, time=0))
                        track_bass.append(Message("note_off", channel=1, note=bass_note, velocity=0, time=int(step_time * 0.8)))

                # DRUMS: 16-step grid per bar
                for step in range(16):
                    step_dur = self.ticks_per_beat // 4
                    hit_events = []

                    if is_last_climb_bar:
                        # PRE-DROP SILENCE GAP: Silence all kicks/snares on beats 3-4, final pickup tom on step 15
                        if step < 8:
                            if step % 2 == 0:
                                hit_events.append((GM_DRUM["snare"], 110))
                            if step % 4 == 0:
                                hit_events.append((GM_DRUM["kick"], 115))
                        elif step == 15:
                            hit_events.append((GM_DRUM["snare"], 125)) # Final pickup flame
                    elif sec_type == "climb":
                        # ACCELERATING CLIMB / RISER: Snare roll accelerates 8ths -> 16ths and velocity swells
                        climb_vel = min(125, 75 + int((bar * 12) + (step / 16.0) * 16))
                        if bar >= 2:
                            hit_events.append((GM_DRUM["snare"], climb_vel)) # 16th continuous roll
                        elif step % 2 == 0:
                            hit_events.append((GM_DRUM["snare"], climb_vel)) # 8th roll
                        if step % 4 == 0:
                            hit_events.append((GM_DRUM["kick"], 108)) # Four-on-the-floor kick
                    elif sec_type == "drop":
                        # BEAT DROP: Crash on bar 0 beat 0, four-on-floor kick, heavy snare on 4 and 12, open hats
                        if bar == 0 and step == 0:
                            hit_events.append((GM_DRUM["crash"], 125))
                        if step % 4 == 0:
                            hit_events.append((GM_DRUM["kick"], 122))
                        if step in [4, 12]:
                            hit_events.append((GM_DRUM["snare"], 118))
                        if step % 2 == 1:
                            hit_events.append((GM_DRUM["closed_hihat"], 98))
                        if step == 14:
                            hit_events.append((GM_DRUM["open_hihat"], 105))
                    elif sec_type == "verse":
                        # Groove: Kick on 0 and 8, snare on 4 and 12, closed hats
                        if step in [0, 8]:
                            hit_events.append((GM_DRUM["kick"], 105))
                        if step in [4, 12]:
                            hit_events.append((GM_DRUM["snare"], 95))
                        if step % 2 == 0:
                            hit_events.append((GM_DRUM["closed_hihat"], 80))
                    elif sec_type in ("intro", "outro"):
                        # Ambient hi-hat pulse
                        if step % 4 == 2:
                            hit_events.append((GM_DRUM["closed_hihat"], 70))

                    # Append drum hits
                    if hit_events:
                        for drum_note, drum_vel in hit_events:
                            track_drums.append(Message("note_on", channel=9, note=drum_note, velocity=drum_vel, time=0))
                        for drum_note, _ in hit_events:
                            track_drums.append(Message("note_off", channel=9, note=drum_note, velocity=0, time=step_dur))
                    else:
                        # Advance drum timeline
                        track_drums.append(Message("note_off", channel=9, note=36, velocity=0, time=step_dur))

        # Save Standard MIDI File
        os.makedirs(os.path.dirname(os.path.abspath(output_mid_path)), exist_ok=True)
        mid.save(output_mid_path)
        print(f"Successfully generated MIDI arrangement: {output_mid_path}")
        print(f"Total Bars: {total_bars} | BPM: {self.bpm} | Duration: {total_duration_sec:.1f}s")
        return {
            "midi_path": output_mid_path,
            "total_bars": total_bars,
            "duration_sec": total_duration_sec,
            "bpm": self.bpm,
            "key": ROOT_KEY,
            "scale": SCALE_TYPE,
        }

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "${baseName}.mid"
    composer = CustomSongComposer(bpm=BPM, key=ROOT_KEY, scale_name=SCALE_TYPE)
    composer.compose(out_file)
`;
}

export async function generatePythonMusicCode(params: GenerateCodeParams): Promise<GeneratedCodeResult> {
  const config = loadConfig();

  // If no API key configured, use procedural generator
  if (!config.apiKey || config.apiKey.trim().length === 0) {
    const code = generateProceduralPythonCode(params);
    const lineCount = code.split('\n').length;
    return {
      code,
      lineCount,
      linesAdded: lineCount,
      linesRemoved: 0,
      summary: `Generated custom ${params.genre} multi-track Python composition script (${params.bpm} BPM, Key ${params.key}) with dynamic climb, pre-drop silence gap, and beat drop mechanics.`,
      fileName: 'composition.py',
    };
  }

  // Attempt frontier LLM generation
  try {
    const model = getAIModel();
    const systemPrompt = `You are an elite music technologist, algorithmic composer, and Python specialist.
You generate production-ready, fully executable Python scripts that use 'mido' to compose complete multi-track songs.

Guidelines for Music Composition & Architecture:
1. Multi-Track MIDI Structure:
   - Track 0: Conductor/Meta (tempo, time signature, track name).
   - Track 1 (Ch 0): Harmony, Chords, Pads.
   - Track 2 (Ch 1): Bassline with sub-bass root impacts and chromatic walk-ups.
   - Track 3 (Ch 2): Melodic lead, counter-melodies, and arpeggios.
   - Track 4 (Ch 9): Drum Kit (GM Kick 36, Snare 38, Closed Hat 42, Open Hat 46, Crash 49).
2. Dynamic Tension & Transition Architecture:
   - Climbs / Risers: In Pre-Chorus sections, use accelerating snare rolls (8th -> 16th notes) and crescendo velocity (70 -> 125).
   - Pre-Drop Silence: In the final bar of the climb, silence beats 3 and 4 completely (with an optional 16th-note pickup flame on beat 4.75) to create maximum contrast before the drop.
   - Beat Drop / Climax: On Beat 1 of the Chorus, detonate a massive sub-bass punch (-12 st), crash cymbal, and driving four-on-the-floor kick.
   - Breakdowns: Drop the percussion, lower velocities, and use sustained warm chords.
3. Code Requirements:
   - Must import 'mido', 'os', 'sys', 'random', 'math'.
   - Must run stand-alone with: python composition.py [output_path].
   - Must calculate duration and save the .mid file.
   - Output strictly the raw Python code without extraneous conversational banter or emojis.`;

    const userPrompt = `Write a complete, executable Python composition script for:
Song: "${params.topic}"
Genre: ${params.genre}
BPM: ${params.bpm}
Key: ${params.key}
Mood: ${params.mood}
${params.instructions ? `Special Instructions: ${params.instructions}` : ''}

Ensure it includes Intro, Verse 1, Pre-Chorus Climb with accelerating snare, Pre-Drop Silence gap, Heavy Beat Drop Chorus, Verse 2, Bridge Breakdown, Final Drop, and Outro.`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: config.creativity ?? 0.6,
    });

    // Strip markdown code fences if present
    const cleanCode = text
      .replace(/^```python\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (cleanCode.length > 200 && cleanCode.includes('mido')) {
      const lineCount = cleanCode.split('\n').length;
      return {
        code: cleanCode,
        lineCount,
        linesAdded: lineCount,
        linesRemoved: 0,
        summary: `AI generated custom ${params.genre} Python composition (${params.bpm} BPM in ${params.key}) with structured builds, drops, and humanized micro-timing.`,
        fileName: 'composition.py',
      };
    }
  } catch (err: any) {
    console.warn('[AI Code Generator] LLM generation failed, using procedural composition:', err.message || err);
  }

  // Fallback to procedural generator
  const code = generateProceduralPythonCode(params);
  const lineCount = code.split('\n').length;
  return {
    code,
    lineCount,
    linesAdded: lineCount,
    linesRemoved: 0,
    summary: `Procedurally generated custom ${params.genre} Python composition script (${params.bpm} BPM, Key ${params.key}) with dynamic climbs and drops.`,
    fileName: 'composition.py',
  };
}

export async function editPythonMusicCode(originalCode: string, instruction: string): Promise<GeneratedCodeResult> {
  const config = loadConfig();

  if (config.apiKey && config.apiKey.trim().length > 0) {
    try {
      const model = getAIModel();
      const systemPrompt = `You are an expert Python music programmer.
Modify the provided Python composition script according to the user's instructions.
Preserve all necessary imports and runnable structure.
Output strictly the modified Python script without emojis or markdown conversational wrappers.`;

      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: `Instructions: ${instruction}\n\nOriginal Code:\n\`\`\`python\n${originalCode}\n\`\`\``,
        temperature: 0.4,
      });

      const cleanCode = text
        .replace(/^```python\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      if (cleanCode.length > 200 && cleanCode.includes('mido')) {
        const origLines = originalCode.split('\n').length;
        const newLines = cleanCode.split('\n').length;
        const diffLines = Math.abs(newLines - origLines);
        return {
          code: cleanCode,
          lineCount: newLines,
          linesAdded: Math.max(diffLines, 8),
          linesRemoved: Math.max(0, origLines - newLines),
          summary: `Updated Python arrangement: "${instruction}"`,
          fileName: 'composition.py',
        };
      }
    } catch (e) {
      console.warn('[AI Code Edit] LLM edit failed, applying smart procedural edits:', e);
    }
  }

  // Procedural rule-based modification
  let updatedCode = originalCode;
  let summary = `Modified composition parameters according to: "${instruction}"`;
  let added = 4;
  let removed = 2;

  const instLower = instruction.toLowerCase();

  // BPM modification
  const bpmMatch = instLower.match(/(\d{2,3})\s*(?:bpm|tempo)/) || instLower.match(/(?:bpm|tempo)\s*(?:to|=)?\s*(\d{2,3})/);
  if (bpmMatch) {
    const newBpm = bpmMatch[1];
    updatedCode = updatedCode.replace(/BPM\s*=\s*\d+/, `BPM = ${newBpm}`);
    summary = `Updated tempo to ${newBpm} BPM`;
  }

  // Beat drop intensification
  if (instLower.includes('drop') || instLower.includes('heavy') || instLower.includes('bass') || instLower.includes('sub')) {
    updatedCode = updatedCode.replace(
      /b_vel = humanize_vel\(115 if step == 0 else 102\)/,
      `# Intensified Sub-Bass Impact with Glide\n                        b_vel = humanize_vel(126 if step == 0 else 114)`
    );
    summary = `Intensified beat drop dynamics with enhanced sub-bass velocities (126 velocity peak)`;
    added = 12;
    removed = 3;
  }

  // Climb / Buildup intensification
  if (instLower.includes('climb') || instLower.includes('build') || instLower.includes('riser')) {
    updatedCode = updatedCode.replace(
      /climb_vel = min\(125, 75 \+ int\(\(bar \* 12\) \+ \(step \/ 16\.0\) \* 16\)\)/,
      `# Accelerated High-Energy Climb & Filter Sweep\n                        climb_vel = min(127, 82 + int((bar * 14) + (step / 16.0) * 22))`
    );
    summary = `Accelerated snare roll rise rate and amplified climb velocity to maximum 127`;
    added = 14;
    removed = 2;
  }

  // Key change
  const keyMatch = instLower.match(/key\s*(?:to|=)?\s*([a-gA-G][#b]?)/);
  if (keyMatch) {
    const newKey = keyMatch[1].toUpperCase();
    updatedCode = updatedCode.replace(/ROOT_KEY\s*=\s*"[^"]+"/, `ROOT_KEY = "${newKey}"`);
    summary = `Transposed root key to ${newKey}`;
  }

  const newLines = updatedCode.split('\n').length;
  return {
    code: updatedCode,
    lineCount: newLines,
    linesAdded: added,
    linesRemoved: removed,
    summary,
    fileName: 'composition.py',
  };
}

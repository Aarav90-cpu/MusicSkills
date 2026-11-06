"""
MusicSkills - Song Generator Engine
Transforms musical specifications (topic, genre, mood, purpose, tempo, key)
into humanized multi-track Standard MIDI (.mid) arrangements and synchronized
timestamped vocal lead sheets.
"""

from dataclasses import dataclass
import math
import os
import random
from typing import Any, Dict, List, Optional, Tuple

import mido
from mido import Message, MetaMessage, MidiFile, MidiTrack

from scripts.humanizer import Humanizer, default_humanizer
from scripts.lyrics_timing import LyricsTimingManager, SongSection


# --- MUSIC THEORY DATASETS ---

SCALES: Dict[str, List[int]] = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "harmonic_minor": [0, 2, 3, 5, 7, 8, 11],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "pentatonic_major": [0, 2, 4, 7, 9],
    "pentatonic_minor": [0, 3, 5, 7, 10],
    "blues": [0, 3, 5, 6, 7, 10],
    "bhairav": [0, 1, 4, 5, 7, 8, 11],  # Classical Indian Raga Mayamalavagowla / Bhairav
}

NOTE_NAMES: Dict[str, int] = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}

# Standard General MIDI Program Numbers (0-indexed)
GM_INSTRUMENTS = {
    "acoustic_grand": 0,
    "electric_piano": 4,
    "rock_organ": 18,
    "nylon_guitar": 24,
    "overdriven_guitar": 29,
    "distortion_guitar": 30,
    "acoustic_bass": 32,
    "finger_bass": 33,
    "slap_bass": 36,
    "synth_bass_1": 38,
    "synth_bass_2": 39,
    "sitar": 104,
    "synth_lead": 80,
    "saw_lead": 81,
    "synth_pad": 89,
}

# General MIDI Drum Map (Channel 10, 0-indexed as 9)
GM_DRUMS = {
    "kick": 36,
    "rimshot": 37,
    "snare": 38,
    "clap": 39,
    "electric_snare": 40,
    "closed_hihat": 42,
    "pedal_hihat": 44,
    "open_hihat": 46,
    "crash": 49,
    "ride": 51,
    "cowbell": 56,
}


@dataclass
class GenreProfile:
    """Stylistic and production characteristics for a musical genre."""
    name: str
    default_bpm: int
    scale_type: str
    harmony_instrument: int
    bass_instrument: int
    lead_instrument: int
    drum_style: str
    chord_progression: List[List[int]]  # Semitone root offsets for standard chords


GENRE_PROFILES: Dict[str, GenreProfile] = {
    "pop": GenreProfile(
        name="Pop",
        default_bpm=120,
        scale_type="major",
        harmony_instrument=GM_INSTRUMENTS["electric_piano"],
        bass_instrument=GM_INSTRUMENTS["synth_bass_1"],
        lead_instrument=GM_INSTRUMENTS["synth_lead"],
        drum_style="four_on_floor",
        chord_progression=[[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],  # I - V - vi - IV
    ),
    "hip-hop": GenreProfile(
        name="Hip-Hop / Rap",
        default_bpm=88,
        scale_type="minor",
        harmony_instrument=GM_INSTRUMENTS["electric_piano"],
        bass_instrument=GM_INSTRUMENTS["synth_bass_2"],
        lead_instrument=GM_INSTRUMENTS["acoustic_grand"],
        drum_style="boom_bap",
        chord_progression=[[0, 3, 7], [8, 12, 15], [3, 7, 10], [7, 10, 14]],  # i - VI - III - v
    ),
    "rock": GenreProfile(
        name="Rock",
        default_bpm=128,
        scale_type="minor",
        harmony_instrument=GM_INSTRUMENTS["overdriven_guitar"],
        bass_instrument=GM_INSTRUMENTS["finger_bass"],
        lead_instrument=GM_INSTRUMENTS["distortion_guitar"],
        drum_style="rock_drive",
        chord_progression=[[0, 3, 7], [5, 8, 12], [8, 12, 15], [7, 10, 14]],  # i - iv - VI - V
    ),
    "electronic": GenreProfile(
        name="Electronic / EDM",
        default_bpm=126,
        scale_type="minor",
        harmony_instrument=GM_INSTRUMENTS["synth_pad"],
        bass_instrument=GM_INSTRUMENTS["synth_bass_1"],
        lead_instrument=GM_INSTRUMENTS["saw_lead"],
        drum_style="edm_energy",
        chord_progression=[[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]],  # i - VI - iv - v
    ),
    "phonk": GenreProfile(
        name="Phonk",
        default_bpm=135,
        scale_type="harmonic_minor",
        harmony_instrument=GM_INSTRUMENTS["electric_piano"],
        bass_instrument=GM_INSTRUMENTS["synth_bass_2"],
        lead_instrument=GM_INSTRUMENTS["saw_lead"],
        drum_style="drift_phonk",
        chord_progression=[[0, 3, 7], [8, 12, 15], [10, 14, 17], [7, 10, 14]],
    ),
    "indian": GenreProfile(
        name="Indian Music",
        default_bpm=96,
        scale_type="bhairav",
        harmony_instrument=GM_INSTRUMENTS["synth_pad"],
        bass_instrument=GM_INSTRUMENTS["acoustic_bass"],
        lead_instrument=GM_INSTRUMENTS["sitar"],
        drum_style="indian_fusion",
        chord_progression=[[0, 4, 7], [1, 5, 8], [5, 8, 12], [7, 11, 14]],  # Bhairav modal progression
    ),
    "jazz": GenreProfile(
        name="Jazz",
        default_bpm=110,
        scale_type="dorian",
        harmony_instrument=GM_INSTRUMENTS["acoustic_grand"],
        bass_instrument=GM_INSTRUMENTS["acoustic_bass"],
        lead_instrument=GM_INSTRUMENTS["nylon_guitar"],
        drum_style="jazz_swing",
        chord_progression=[[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19]],  # ii-V-I-vi
    ),
    "country": GenreProfile(
        name="Country / Folk",
        default_bpm=105,
        scale_type="major",
        harmony_instrument=GM_INSTRUMENTS["nylon_guitar"],
        bass_instrument=GM_INSTRUMENTS["acoustic_bass"],
        lead_instrument=GM_INSTRUMENTS["acoustic_grand"],
        drum_style="country_train",
        chord_progression=[[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],  # I - IV - V - I
    ),
    "reggae": GenreProfile(
        name="Reggae / Caribbean",
        default_bpm=78,
        scale_type="major",
        harmony_instrument=GM_INSTRUMENTS["rock_organ"],
        bass_instrument=GM_INSTRUMENTS["finger_bass"],
        lead_instrument=GM_INSTRUMENTS["synth_lead"],
        drum_style="reggae_one_drop",
        chord_progression=[[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]],
    ),
    "metal": GenreProfile(
        name="Metal",
        default_bpm=145,
        scale_type="phrygian",
        harmony_instrument=GM_INSTRUMENTS["distortion_guitar"],
        bass_instrument=GM_INSTRUMENTS["slap_bass"],
        lead_instrument=GM_INSTRUMENTS["distortion_guitar"],
        drum_style="metal_blast",
        chord_progression=[[0, 3, 7], [1, 5, 8], [0, 3, 7], [8, 12, 15]],  # Heavy tritone/phrygian riff
    ),
}


class SongGenerator:
    """
    Main generative music system combining arrangement, humanization,
    MIDI composition, and lyrical timing synchronization.
    """

    def __init__(
        self,
        topic: str = "Journey to the Stars",
        genre: str = "pop",
        mood: str = "energetic",
        purpose: str = "workout music",
        root_key: str = "C",
        tempo_bpm: Optional[int] = None,
        humanizer: Optional[Humanizer] = None,
        seed: Optional[int] = None,
    ):
        self.topic = topic
        self.genre_key = genre.lower().replace(" ", "-")
        self.profile = GENRE_PROFILES.get(self.genre_key, GENRE_PROFILES["pop"])
        self.mood = mood.lower()
        self.purpose = purpose.lower()
        self.root_key = root_key.upper()
        self.root_midi = 60 + NOTE_NAMES.get(self.root_key, 0)  # Middle C = 60
        self.bpm = tempo_bpm or self.profile.default_bpm
        self.humanizer = humanizer or Humanizer(seed=seed)
        self.rng = random.Random(seed)
        self.ticks_per_beat = 480
        self.timing_mgr = LyricsTimingManager(bpm=self.bpm, beats_per_bar=4, ticks_per_beat=self.ticks_per_beat)

    def _build_sections(self) -> List[Tuple[str, str, int, str]]:
        """
        Defines the canonical song structure with 7 primary sections:
        Intro -> Verse 1 -> Pre-Chorus -> Chorus 1 -> Verse 2 -> Chorus 2 ->
        Instrumental Break -> Bridge -> Chorus 3 (Climax) -> Outro.
        """
        return [
            ("Intro", "intro", 4, "low"),
            ("Verse 1", "verse", 8, "medium"),
            ("Pre-Chorus", "pre-chorus", 4, "medium"),
            ("Chorus 1", "chorus", 8, "high"),
            ("Verse 2", "verse", 8, "medium"),
            ("Chorus 2", "chorus", 8, "high"),
            ("Instrumental Break", "instrumental_break", 4, "high"),
            ("Bridge", "bridge", 8, "medium"),
            ("Chorus 3 (Climax)", "chorus", 8, "climax"),
            ("Outro", "outro", 4, "low"),
        ]

    def _craft_lyrics_for_topic(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Crafts rhythmic, singable lyrics directly thematic to the given topic, mood, and purpose.
        Returns lines with text, beat offset, duration, and pitch recommendations.
        """
        t = self.topic.title()
        m = self.mood
        p = self.purpose

        return {
            "Verse 1": [
                {"text": f"Footsteps echoing, the morning turns the key", "offset": 0.0, "dur": 3.5, "pitch": "C4-D4-E4", "dyn": "mf", "note": "Clear, observational narrative"},
                {"text": f"Thinking 'bout {t}, everything we're meant to be", "offset": 4.0, "dur": 3.5, "pitch": "E4-F4-G4", "dyn": "mf", "note": "Lean into the lyric"},
                {"text": f"The shadows fade away against the burning neon sign", "offset": 8.0, "dur": 3.5, "pitch": "C4-D4-E4", "dyn": "mf", "note": "Even breath, sustained tone"},
                {"text": f"We're crossing over boundaries, stepping past the line", "offset": 12.0, "dur": 3.5, "pitch": "E4-G4-A4", "dyn": "f", "note": "Push energy upward"},
            ],
            "Pre-Chorus": [
                {"text": f"Feel the pulse begin to rise", "offset": 0.0, "dur": 3.2, "pitch": "A4-G4-F4", "dyn": "f", "note": "Crisp staccato buildup"},
                {"text": f"There's no turning back tonight, open up your eyes", "offset": 4.0, "dur": 3.5, "pitch": "G4-A4-B4", "dyn": "f", "note": "Full chest voice climb"},
            ],
            "Chorus 1": [
                {"text": f"This is our time, living for {t}!", "offset": 0.0, "dur": 3.5, "pitch": "C5-B4-A4-G4", "dyn": "ff", "note": "Anthemic, explosive vocal hook"},
                {"text": f"Nothing can hold us down, we break the atmospheric blue", "offset": 4.0, "dur": 3.5, "pitch": "E4-G4-A4-C5", "dyn": "ff", "note": "Hold long sustain"},
                {"text": f"Feel the thunder roll, a fire in the heart", "offset": 8.0, "dur": 3.5, "pitch": "D5-C5-B4-A4", "dyn": "ff", "note": "Passionate vibrato"},
                {"text": f"We wrote the future before the journey could start", "offset": 12.0, "dur": 3.5, "pitch": "G4-A4-C5", "dyn": "f", "note": "Triumphant resolution"},
            ],
            "Verse 2": [
                {"text": f"Every highway stretched across the endless silver rain", "offset": 0.0, "dur": 3.5, "pitch": "C4-D4-E4", "dyn": "mf", "note": "Intimate, reflective delivery"},
                {"text": f"We paid the price in gold to rise above the quiet pain", "offset": 4.0, "dur": 3.5, "pitch": "E4-F4-G4", "dyn": "mf", "note": "Build tension smoothly"},
                {"text": f"Now the horizon bends to greet the promise we made", "offset": 8.0, "dur": 3.5, "pitch": "C4-D4-E4", "dyn": "mf", "note": "Confident phrasing"},
                {"text": f"A testament of iron that will never, ever fade", "offset": 12.0, "dur": 3.5, "pitch": "E4-G4-A4", "dyn": "f", "note": "Strong conviction"},
            ],
            "Chorus 2": [
                {"text": f"This is our time, living for {t}!", "offset": 0.0, "dur": 3.5, "pitch": "C5-B4-A4-G4", "dyn": "ff", "note": "Full anthemic hook"},
                {"text": f"Nothing can hold us down, we break the atmospheric blue", "offset": 4.0, "dur": 3.5, "pitch": "E4-G4-A4-C5", "dyn": "ff", "note": "Power vocal sustain"},
                {"text": f"Feel the thunder roll, a fire in the heart", "offset": 8.0, "dur": 3.5, "pitch": "D5-C5-B4-A4", "dyn": "ff", "note": "Rhythmic punch"},
                {"text": f"We wrote the future before the journey could start", "offset": 12.0, "dur": 3.5, "pitch": "G4-A4-C5", "dyn": "f", "note": "Ring out with confidence"},
            ],
            "Bridge": [
                {"text": f"When the noise clears out, what remains behind?", "offset": 0.0, "dur": 3.5, "pitch": "A4-E4-F4", "dyn": "p", "note": "Airy, vulnerable falsetto or head voice"},
                {"text": f"A spark of silver light inside the dreaming mind", "offset": 4.0, "dur": 3.5, "pitch": "G4-D4-E4", "dyn": "mp", "note": "Gradual crescendo"},
                {"text": f"It calls our names across the darkness and the cold", "offset": 8.0, "dur": 3.5, "pitch": "F4-A4-C5", "dyn": "mf", "note": "Expanding warmth"},
                {"text": f"Watch as the greatest story finally unfolds!", "offset": 12.0, "dur": 3.5, "pitch": "G4-B4-D5", "dyn": "ff", "note": "High power belt into climax"},
            ],
            "Chorus 3 (Climax)": [
                {"text": f"This is our time, living for {t}!", "offset": 0.0, "dur": 3.5, "pitch": "C5-B4-A4-G4", "dyn": "fff", "note": "Maximum power, ad-lib run"},
                {"text": f"We shook the ground, we made the impossible true", "offset": 4.0, "dur": 3.5, "pitch": "E4-G4-A4-C5", "dyn": "fff", "note": "Full belt with vocal vibrato"},
                {"text": f"Feel the thunder roll, shining in the light", "offset": 8.0, "dur": 3.5, "pitch": "D5-C5-B4-A4", "dyn": "ff", "note": "Soulful expression"},
                {"text": f"We reign forever in the victory tonight!", "offset": 12.0, "dur": 3.5, "pitch": "G4-A4-C5", "dyn": "ff", "note": "Triumphant ending hold"},
            ],
            "Outro": [
                {"text": f"Living for {t}...", "offset": 0.0, "dur": 3.0, "pitch": "E4-D4-C4", "dyn": "p", "note": "Gentle decrescendo, whisper fade"},
                {"text": f"Until the stars come home...", "offset": 4.0, "dur": 3.5, "pitch": "D4-C4", "dyn": "pp", "note": "Final resonant breath"},
            ],
        }

    def generate_song(self, output_dir: str = "outputs", base_name: str = "song") -> Dict[str, str]:
        """
        Executes complete music production:
        1. Arranges sections and computes synchronized timings.
        2. Renders 5-track humanized Standard MIDI file.
        3. Exports Vocal Lead Sheet (Markdown), LRC file, and JSON timing map.
        """
        os.makedirs(output_dir, exist_ok=True)
        sections_spec = self._build_sections()
        lyrics_data = self._craft_lyrics_for_topic()

        current_bar = 0
        built_sections: List[SongSection] = []

        for name, stype, nbars, energy in sections_spec:
            sec = self.timing_mgr.add_section(
                name=name,
                section_type=stype,
                start_bar=current_bar,
                num_bars=nbars,
                energy_level=energy,
            )
            built_sections.append(sec)

            # Attach lyrical lines if present
            if name in lyrics_data:
                for item in lyrics_data[name]:
                    # convert line beat offset to bar + beat
                    line_bar_offset = item["offset"] / 4.0
                    line_beat_offset = item["offset"] % 4.0
                    self.timing_mgr.add_lyric_line(
                        section=sec,
                        text=item["text"],
                        bar_offset=line_bar_offset,
                        beat_offset=line_beat_offset,
                        duration_beats=item["dur"],
                        pitch_guide=item.get("pitch"),
                        vocal_dynamic=item.get("dyn"),
                        delivery_note=item.get("note"),
                    )

            current_bar += nbars

        total_bars = current_bar

        # Build Multi-Track MIDI File
        midi = MidiFile(type=1, ticks_per_beat=self.ticks_per_beat)

        # Track 0: Conductor & Metadata
        track_conductor = MidiTrack()
        midi.tracks.append(track_conductor)
        track_conductor.append(MetaMessage("track_name", name=f"{self.topic} - Conductor", time=0))
        tempo_microseconds = mido.bpm2tempo(self.bpm)
        track_conductor.append(MetaMessage("set_tempo", tempo=tempo_microseconds, time=0))
        track_conductor.append(MetaMessage("time_signature", numerator=4, denominator=4, time=0))

        # Add section markers as MIDI cue points
        for sec in built_sections:
            marker_tick = int(sec.start_bar * 4 * self.ticks_per_beat)
            track_conductor.append(MetaMessage("marker", text=f"Section: {sec.name}", time=0))

        # Track 1: Harmony Chords (Channel 0)
        track_harmony = self._create_harmony_track(built_sections)
        midi.tracks.append(track_harmony)

        # Track 2: Bassline (Channel 1)
        track_bass = self._create_bass_track(built_sections)
        midi.tracks.append(track_bass)

        # Track 3: Vocal Guide Melody (Channel 2)
        track_vocal_guide = self._create_vocal_guide_track(built_sections)
        midi.tracks.append(track_vocal_guide)

        # Track 4: Drums & Percussion (Channel 9 / General MIDI Channel 10)
        track_drums = self._create_drums_track(built_sections)
        midi.tracks.append(track_drums)

        # Save MIDI file
        midi_path = os.path.join(output_dir, f"{base_name}.mid")
        midi.save(midi_path)

        # Export Singer Lead Sheet (.md)
        lead_sheet_content = self.timing_mgr.export_lead_sheet_markdown(
            title=f"{self.topic} ({self.profile.name} - {self.mood.capitalize()})",
            genre=self.profile.name,
            mood=self.mood.capitalize(),
            purpose=self.purpose.capitalize(),
        )
        lead_sheet_path = os.path.join(output_dir, f"{base_name}_lead_sheet.md")
        with open(lead_sheet_path, "w", encoding="utf-8") as f:
            f.write(lead_sheet_content)

        # Export Synced LRC file
        lrc_path = os.path.join(output_dir, f"{base_name}.lrc")
        with open(lrc_path, "w", encoding="utf-8") as f:
            f.write(self.timing_mgr.export_lrc())

        # Export Timing JSON
        json_path = os.path.join(output_dir, f"{base_name}_timing.json")
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(self.timing_mgr.export_json())

        # Export SRT Subtitles
        srt_path = os.path.join(output_dir, f"{base_name}.srt")
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(self.timing_mgr.export_srt())

        return {
            "midi": midi_path,
            "lead_sheet": lead_sheet_path,
            "lrc": lrc_path,
            "json": json_path,
            "srt": srt_path,
        }

    def _create_harmony_track(self, sections: List[SongSection]) -> MidiTrack:
        """Renders chord progressions with humanized timing, velocity, and voice leading."""
        track = MidiTrack()
        track.append(MetaMessage("track_name", name="Harmony Chords", time=0))
        track.append(Message("program_change", channel=0, program=self.profile.harmony_instrument, time=0))

        progression = self.profile.chord_progression
        current_tick = 0

        for sec in sections:
            # Intro and Outro might play sparse chords; Chorus is dense
            chord_density = 2 if sec.energy_level in ("high", "climax") else 1  # 2 chords per bar or 1

            for bar in range(sec.num_bars):
                chord_idx = bar % len(progression)
                chord_semitones = progression[chord_idx]

                # Root base octave 4 (MIDI 60)
                chord_notes = [self.root_midi + s for s in chord_semitones]

                # Humanize note-on timing
                raw_delta = 0 if current_tick == 0 else self.ticks_per_beat * (4 // chord_density)
                delta_time = self.humanizer.humanize_time(raw_delta)
                base_vel = 85 if sec.energy_level != "low" else 65
                duration = self.humanizer.humanize_duration(self.ticks_per_beat * (4 // chord_density) - 40, style="legato")

                # Note Ons
                for i, note in enumerate(chord_notes):
                    vel = self.humanizer.humanize_velocity(base_vel, beat_in_bar=0.0, variance=8)
                    t = delta_time if i == 0 else self.humanizer.humanize_time(4, jitter_range=(-3, 3))
                    track.append(Message("note_on", channel=0, note=note, velocity=vel, time=t))

                # Note Offs
                for i, note in enumerate(chord_notes):
                    t = duration if i == 0 else 0
                    track.append(Message("note_off", channel=0, note=note, velocity=0, time=t))

                current_tick += self.ticks_per_beat * (4 // chord_density)

        return track

    def _create_bass_track(self, sections: List[SongSection]) -> MidiTrack:
        """Renders driving, rhythmic basslines with organic micro-timing."""
        track = MidiTrack()
        track.append(MetaMessage("track_name", name="Bassline", time=0))
        track.append(Message("program_change", channel=1, program=self.profile.bass_instrument, time=0))

        progression = self.profile.chord_progression
        bass_root_octave = self.root_midi - 24  # Octave 2 (around MIDI 36)

        for sec in sections:
            is_break = sec.section_type in ("intro", "outro") and sec.energy_level == "low"
            if is_break:
                # Rest or sustained whole notes during calm intro/outro
                for bar in range(sec.num_bars):
                    chord_idx = bar % len(progression)
                    root_note = bass_root_octave + progression[chord_idx][0]
                    vel = self.humanizer.humanize_velocity(60, variance=6)
                    dur = self.humanizer.humanize_duration(self.ticks_per_beat * 3, style="legato")
                    track.append(Message("note_on", channel=1, note=root_note, velocity=vel, time=10))
                    track.append(Message("note_off", channel=1, note=root_note, velocity=0, time=dur))
                    # pad rest
                    track.append(Message("note_on", channel=1, note=root_note, velocity=0, time=self.ticks_per_beat))
                    track.append(Message("note_off", channel=1, note=root_note, velocity=0, time=0))
                continue

            for bar in range(sec.num_bars):
                chord_idx = bar % len(progression)
                root_note = bass_root_octave + progression[chord_idx][0]
                fifth_note = root_note + 7

                # 8th note driving bassline (beats 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5)
                sub_pattern = [root_note, root_note, root_note, fifth_note, root_note, root_note, fifth_note, root_note]
                base_vel = 100 if sec.energy_level in ("high", "climax") else 82

                for step_idx, note in enumerate(sub_pattern):
                    beat_val = step_idx * 0.5
                    vel = self.humanizer.humanize_velocity(base_vel, beat_in_bar=beat_val, variance=10)
                    delta = self.humanizer.humanize_time(int(self.ticks_per_beat * 0.5))
                    dur = self.humanizer.humanize_duration(int(self.ticks_per_beat * 0.45), style="natural")

                    track.append(Message("note_on", channel=1, note=note, velocity=vel, time=delta))
                    track.append(Message("note_off", channel=1, note=note, velocity=0, time=dur))

        return track

    def _create_vocal_guide_track(self, sections: List[SongSection]) -> MidiTrack:
        """
        Renders a vocal guide melody track that matches the syllable cadence
        and lyrical phrasing so singers have an exact auditory pitch reference.
        """
        track = MidiTrack()
        track.append(MetaMessage("track_name", name="Vocal Guide Melody", time=0))
        track.append(Message("program_change", channel=2, program=self.profile.lead_instrument, time=0))

        scale = SCALES.get(self.profile.scale_type, SCALES["minor"])

        for sec in sections:
            if not sec.lines:
                # If this is the Instrumental Break, render an expressive featured solo
                if sec.section_type == "instrumental_break":
                    solo_scale = SCALES.get(self.profile.scale_type, SCALES["minor"])
                    for b in range(sec.num_bars):
                        # Play an 8-note melodic run / solo lick per bar
                        for step_idx in range(8):
                            # Ascending and descending solo contour
                            degree_idx = (step_idx * 2 + (b % 3)) % len(solo_scale)
                            pitch = self.root_midi + 12 + solo_scale[degree_idx]  # 1 octave higher for lead solo
                            vel = self.humanizer.humanize_velocity(104, beat_in_bar=step_idx * 0.5, variance=10)
                            delta = self.humanizer.humanize_time(int(self.ticks_per_beat * 0.5), jitter_range=(-6, 6))
                            dur = self.humanizer.humanize_duration(int(self.ticks_per_beat * 0.46), style="legato")
                            track.append(Message("note_on", channel=2, note=pitch, velocity=vel, time=delta))
                            track.append(Message("note_off", channel=2, note=pitch, velocity=0, time=dur))
                continue

            for line in sec.lines:
                # Synthesize melodic guide notes for the syllables of each line
                words = line.text.split()
                note_duration = max(96, int((line.duration_beats * self.ticks_per_beat) / max(1, len(words))))

                for w_idx, word in enumerate(words):
                    # Melodic contour: rise towards middle of line, resolve on root or fifth
                    degree = scale[(w_idx + (2 if sec.energy_level in ("high", "climax") else 0)) % len(scale)]
                    pitch = self.root_midi + degree

                    vel = self.humanizer.humanize_velocity(92, variance=8)
                    delta = self.humanizer.humanize_time(12, jitter_range=(-5, 5))
                    dur = self.humanizer.humanize_duration(note_duration - 15, style="legato")

                    track.append(Message("note_on", channel=2, note=pitch, velocity=vel, time=delta))
                    track.append(Message("note_off", channel=2, note=pitch, velocity=0, time=dur))

        return track

    def _create_drums_track(self, sections: List[SongSection]) -> MidiTrack:
        """
        Renders expressive drums on General MIDI Channel 10 (channel=9 in zero-indexed mido)
        with dynamic velocities, natural micro-timing jitter, and authentic genre rhythms.
        """
        track = MidiTrack()
        track.append(MetaMessage("track_name", name="Drums & Percussion", time=0))

        kick = GM_DRUMS["kick"]
        rimshot = GM_DRUMS["rimshot"]
        snare = GM_DRUMS["snare"]
        clap = GM_DRUMS["clap"]
        hihat = GM_DRUMS["closed_hihat"]
        open_hat = GM_DRUMS["open_hihat"]
        crash = GM_DRUMS["crash"]
        cowbell = GM_DRUMS["cowbell"]

        style = self.profile.drum_style

        for sec in sections:
            # Crash cymbal on section transitions
            if sec.section_type in ("chorus", "instrumental_break"):
                vel_crash = self.humanizer.humanize_velocity(110, variance=7)
                track.append(Message("note_on", channel=9, note=crash, velocity=vel_crash, time=0))
                track.append(Message("note_off", channel=9, note=crash, velocity=0, time=self.ticks_per_beat))

            is_sparse = sec.section_type in ("intro", "outro") and sec.energy_level == "low"

            for bar in range(sec.num_bars):
                if is_sparse:
                    # Light hi-hat pulse on quarter notes
                    for beat in range(4):
                        v = self.humanizer.humanize_velocity(58, beat_in_bar=beat, variance=6)
                        t = self.humanizer.humanize_time(self.ticks_per_beat)
                        track.append(Message("note_on", channel=9, note=hihat, velocity=v, time=t))
                        track.append(Message("note_off", channel=9, note=hihat, velocity=0, time=40))
                    continue

                # Standard beat pattern (4 beats per bar, 16th note resolution)
                for step in range(16):
                    sub_beat = step / 4.0
                    delta = self.humanizer.humanize_time(int(self.ticks_per_beat / 4.0))

                    events_to_trigger = []

                    # Kick pattern
                    if style == "four_on_floor":
                        if step % 4 == 0:  # Beats 1, 2, 3, 4
                            events_to_trigger.append((kick, 108))
                    elif style == "drift_phonk":
                        if step in (0, 6, 8, 14):
                            events_to_trigger.append((kick, 115))
                        if step % 2 == 0:  # Phonk signature cowbell syncopation
                            events_to_trigger.append((cowbell, 95))
                    elif style == "boom_bap":
                        if step in (0, 7, 10):
                            events_to_trigger.append((kick, 102))
                    elif style == "metal_blast":
                        if step in (0, 2, 4, 6, 8, 10, 12, 14):  # Relentless double-bass kick
                            events_to_trigger.append((kick, 118))
                    elif style == "reggae_one_drop":
                        if step == 8:  # Heavy kick on Beat 3 only
                            events_to_trigger.append((kick, 105))
                    elif style == "indian_fusion":
                        if step in (0, 3, 6, 10):  # Syncopated fusion rhythm
                            events_to_trigger.append((kick, 104))
                    elif style == "jazz_swing":
                        if step == 0:  # Soft feathered acoustic kick
                            events_to_trigger.append((kick, 65))
                    elif style == "country_train":
                        if step in (0, 8):  # Driving bass notes
                            events_to_trigger.append((kick, 98))
                    else:  # Standard rock/pop backbeat
                        if step in (0, 8):
                            events_to_trigger.append((kick, 105))

                    # Snare / Clap pattern
                    if style == "reggae_one_drop":
                        if step == 8:  # Rimshot/snare on Beat 3 alongside kick
                            events_to_trigger.append((rimshot, 108))
                    elif style == "jazz_swing":
                        pass  # Jazz keeps time with ride & pedal hi-hat
                    elif style == "country_train":
                        # Fast train beat alternating accents
                        train_vel = 100 if step in (4, 12) else 65
                        events_to_trigger.append((snare, train_vel))
                    elif step in (4, 12):  # Beats 2 and 4 backbeat
                        snare_note = clap if style in ("drift_phonk", "boom_bap") else snare
                        events_to_trigger.append((snare_note, 105))

                    # Hi-Hat & Cymbals pattern
                    if style == "jazz_swing":
                        if step in (0, 4, 7, 12):  # Swung ride cymbal pattern
                            events_to_trigger.append((GM_DRUMS["ride"], 88))
                        if step in (4, 12):  # Hi-hat foot chick on 2 and 4
                            events_to_trigger.append((GM_DRUMS["pedal_hihat"], 80))
                    elif style == "metal_blast":
                        if step % 2 == 0:
                            events_to_trigger.append((GM_DRUMS["ride"], 95))
                    elif style == "reggae_one_drop":
                        if step % 2 == 1:  # Upbeat 8th skank hi-hat
                            events_to_trigger.append((hihat, 85))
                    elif step % 2 == 0:  # Standard 8th note hats
                        events_to_trigger.append((hihat, 82))
                    elif step == 14 and style == "edm_energy":  # Open hat anticipation
                        events_to_trigger.append((open_hat, 90))

                    # Send note on & off with micro-timing and dynamic velocity
                    for drum_note, base_v in events_to_trigger:
                        v = self.humanizer.humanize_velocity(base_v, beat_in_bar=sub_beat, variance=12)
                        track.append(Message("note_on", channel=9, note=drum_note, velocity=v, time=delta))
                        track.append(Message("note_off", channel=9, note=drum_note, velocity=0, time=35))
                        delta = 0  # subsequent simultaneous events happen at delta 0

        return track


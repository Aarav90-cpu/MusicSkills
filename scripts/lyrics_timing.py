"""
MusicSkills - Lyrical Timestamping & Synchronization Engine
Calculates musical time-to-real-world-time conversions (seconds, milliseconds)
and generates singer-ready lead sheets with precise timestamps for vocal delivery.
"""

from dataclasses import dataclass, field
import json
from typing import Any, Dict, List, Optional


@dataclass
class LyricLine:
    """A single sung lyrical phrase with exact timing and vocal performance guidance."""
    text: str
    start_bar: float
    start_beat: float
    duration_beats: float
    start_seconds: float
    end_seconds: float
    pitch_guide: Optional[str] = None
    vocal_dynamic: Optional[str] = None  # e.g. "p (soft)", "mf (medium)", "f (powerful)"
    delivery_note: Optional[str] = None  # e.g. "Airy breath, push on final word"

    def format_timestamp(self, seconds: float) -> str:
        """Converts floating point seconds into standard [MM:SS.mmm] format using millisecond integer math."""
        total_ms = int(round(seconds * 1000))
        mins = total_ms // 60000
        rem_ms = total_ms % 60000
        secs = rem_ms // 1000
        millis = rem_ms % 1000
        return f"{mins:02d}:{secs:02d}.{millis:03d}"

    @property
    def start_timestamp_str(self) -> str:
        return self.format_timestamp(self.start_seconds)

    @property
    def end_timestamp_str(self) -> str:
        return self.format_timestamp(self.end_seconds)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "start_bar": self.start_bar,
            "start_beat": self.start_beat,
            "duration_beats": self.duration_beats,
            "start_seconds": round(self.start_seconds, 3),
            "end_seconds": round(self.end_seconds, 3),
            "start_timestamp": self.start_timestamp_str,
            "end_timestamp": self.end_timestamp_str,
            "pitch_guide": self.pitch_guide,
            "vocal_dynamic": self.vocal_dynamic,
            "delivery_note": self.delivery_note,
        }


@dataclass
class SongSection:
    """A structural section of the song (Intro, Verse, Chorus, etc.)."""
    name: str
    section_type: str  # intro, verse, pre-chorus, chorus, bridge, instrumental_break, outro
    start_bar: int
    num_bars: int
    start_seconds: float
    end_seconds: float
    energy_level: str  # low, medium, high, climax
    lines: List[LyricLine] = field(default_factory=list)

    def format_timestamp(self, seconds: float) -> str:
        total_ms = int(round(seconds * 1000))
        mins = total_ms // 60000
        rem_ms = total_ms % 60000
        secs = rem_ms // 1000
        millis = rem_ms % 1000
        return f"{mins:02d}:{secs:02d}.{millis:03d}"

    @property
    def start_timestamp_str(self) -> str:
        return self.format_timestamp(self.start_seconds)

    @property
    def end_timestamp_str(self) -> str:
        return self.format_timestamp(self.end_seconds)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "section_type": self.section_type,
            "start_bar": self.start_bar,
            "num_bars": self.num_bars,
            "start_seconds": round(self.start_seconds, 3),
            "end_seconds": round(self.end_seconds, 3),
            "start_timestamp": self.start_timestamp_str,
            "end_timestamp": self.end_timestamp_str,
            "energy_level": self.energy_level,
            "lines": [line.to_dict() for line in self.lines],
        }


class LyricsTimingManager:
    """
    Orchestrates time conversion between musical grid (bars, beats, ticks)
    and physical playback clock (seconds, milliseconds, LRC timestamps).
    """

    def __init__(self, bpm: float = 120.0, beats_per_bar: int = 4, ticks_per_beat: int = 480):
        self.bpm = bpm
        self.beats_per_bar = beats_per_bar
        self.ticks_per_beat = ticks_per_beat
        self.seconds_per_beat = 60.0 / bpm
        self.seconds_per_bar = self.seconds_per_beat * beats_per_bar
        self.sections: List[SongSection] = []

    def bar_beat_to_seconds(self, bar: float, beat: float = 0.0) -> float:
        """Converts 0-indexed bar and beat positions to elapsed seconds."""
        total_beats = (bar * self.beats_per_bar) + beat
        return total_beats * self.seconds_per_beat

    def seconds_to_timestamp(self, seconds: float) -> str:
        """Formats seconds into [MM:SS.mmm]."""
        total_ms = int(round(seconds * 1000))
        mins = total_ms // 60000
        rem_ms = total_ms % 60000
        secs = rem_ms // 1000
        millis = rem_ms % 1000
        return f"{mins:02d}:{secs:02d}.{millis:03d}"

    def seconds_to_srt_timestamp(self, seconds: float) -> str:
        """Formats seconds into standard SRT subtitle format (HH:MM:SS,mmm)."""
        total_ms = int(round(seconds * 1000))
        hours = total_ms // 3600000
        rem_ms = total_ms % 3600000
        mins = rem_ms // 60000
        rem_ms = rem_ms % 60000
        secs = rem_ms // 1000
        millis = rem_ms % 1000
        return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

    def add_section(
        self,
        name: str,
        section_type: str,
        start_bar: int,
        num_bars: int,
        energy_level: str = "medium",
    ) -> SongSection:
        """Registers a musical section and computes its exact timestamp bounds."""
        start_sec = self.bar_beat_to_seconds(start_bar, 0.0)
        end_sec = self.bar_beat_to_seconds(start_bar + num_bars, 0.0)
        section = SongSection(
            name=name,
            section_type=section_type.lower(),
            start_bar=start_bar,
            num_bars=num_bars,
            start_seconds=start_sec,
            end_seconds=end_sec,
            energy_level=energy_level,
        )
        self.sections.append(section)
        return section

    def add_lyric_line(
        self,
        section: SongSection,
        text: str,
        bar_offset: float,
        beat_offset: float,
        duration_beats: float,
        pitch_guide: Optional[str] = None,
        vocal_dynamic: Optional[str] = None,
        delivery_note: Optional[str] = None,
    ) -> LyricLine:
        """Adds a vocal line to a section with precise timestamping."""
        absolute_bar = section.start_bar + bar_offset
        start_sec = self.bar_beat_to_seconds(absolute_bar, beat_offset)
        end_sec = start_sec + (duration_beats * self.seconds_per_beat)

        line = LyricLine(
            text=text,
            start_bar=absolute_bar,
            start_beat=beat_offset,
            duration_beats=duration_beats,
            start_seconds=start_sec,
            end_seconds=end_sec,
            pitch_guide=pitch_guide,
            vocal_dynamic=vocal_dynamic,
            delivery_note=delivery_note,
        )
        section.lines.append(line)
        return line

    def export_lead_sheet_markdown(self, title: str, genre: str, mood: str, purpose: str) -> str:
        """
        Generates a singer-ready lead sheet with precise timestamps,
        delivery instructions, and section transitions.
        """
        total_duration_sec = self.sections[-1].end_seconds if self.sections else 0.0
        header = [
            f"# {title} - Vocal Lead Sheet & Timing Map",
            "",
            "> **DISCLAIMER**: This file provides vocal timing cues and lyrics. The musical backing is generated in the accompanying MIDI arrangement. Sing or feed these timestamped lyrics into your vocal synthesizer to match the musical backing tracks.",
            "",
            "## Song Metadata",
            f"- **Tempo**: {self.bpm} BPM (4/4 time signature)",
            f"- **Genre**: {genre}",
            f"- **Mood**: {mood}",
            f"- **Purpose**: {purpose}",
            f"- **Total Duration**: {self.seconds_to_timestamp(total_duration_sec)} ({len(self.sections)} sections)",
            "",
            "---",
            "",
            "## Timed Lyrical Performance Guide",
            "",
        ]

        body = []
        for sec in self.sections:
            body.append(f"### [{sec.start_timestamp_str} - {sec.end_timestamp_str}] {sec.name.upper()} (Bars {sec.start_bar + 1}–{sec.start_bar + sec.num_bars})")
            body.append(f"*Energy Level: {sec.energy_level.capitalize()}*")
            body.append("")

            if not sec.lines:
                if sec.section_type in ("intro", "outro", "instrumental_break"):
                    body.append("*(Instrumental passage — maintain groove, prepare for next vocal entrance)*\n")
                else:
                    body.append("*(Instrumental / Rest)*\n")
            else:
                for line in sec.lines:
                    vocal_info = []
                    if line.pitch_guide:
                        vocal_info.append(f"Key/Notes: `{line.pitch_guide}`")
                    if line.vocal_dynamic:
                        vocal_info.append(f"Dynamic: **{line.vocal_dynamic}**")
                    if line.delivery_note:
                        vocal_info.append(f"Style: *{line.delivery_note}*")

                    info_str = f" | {', '.join(vocal_info)}" if vocal_info else ""
                    body.append(f"- **[{line.start_timestamp_str} -> {line.end_timestamp_str}]** {line.text}{info_str}")
                body.append("")

        return "\n".join(header + body)

    def export_lrc(self) -> str:
        """Generates standard synced LRC format for synchronized media/karaoke players."""
        lines = [
            f"[ar:AI Music Skill]",
            f"[ti:Arrangement Performance]",
            f"[length:{self.seconds_to_timestamp(self.sections[-1].end_seconds if self.sections else 0.0)}]",
            "",
        ]
        for sec in self.sections:
            lines.append(f"[{sec.start_timestamp_str[:8]}] --- {sec.name} ---")
            for line in sec.lines:
                # Standard LRC timestamp format is [mm:ss.xx]
                timestamp_lrc = f"[{int(line.start_seconds // 60):02d}:{line.start_seconds % 60:05.2f}]"
                lines.append(f"{timestamp_lrc}{line.text}")
        return "\n".join(lines)

    def export_srt(self) -> str:
        """Generates standard SubRip (.srt) subtitle cues for video overlays."""
        entries = []
        cue_idx = 1
        for sec in self.sections:
            for line in sec.lines:
                start_srt = self.seconds_to_srt_timestamp(line.start_seconds)
                end_srt = self.seconds_to_srt_timestamp(line.end_seconds)
                entries.append(f"{cue_idx}\n{start_srt} --> {end_srt}\n{line.text}\n")
                cue_idx += 1
        return "\n".join(entries)

    def export_json(self) -> str:
        """Generates structured JSON data representation of the complete arrangement timing."""
        data = {
            "bpm": self.bpm,
            "beats_per_bar": self.beats_per_bar,
            "seconds_per_beat": round(self.seconds_per_beat, 4),
            "seconds_per_bar": round(self.seconds_per_bar, 4),
            "total_duration_seconds": round(self.sections[-1].end_seconds if self.sections else 0.0, 3),
            "sections": [sec.to_dict() for sec in self.sections],
        }
        return json.dumps(data, indent=2)

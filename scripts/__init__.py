"""
MusicSkills: Professional AI Music Generation & Humanization Toolkit.
"""

from scripts.humanizer import HumanizeConfig, Humanizer, default_humanizer
from scripts.lyrics_timing import LyricLine, LyricsTimingManager, SongSection
from scripts.song_generator import GENRE_PROFILES, GenreProfile, SongGenerator, parse_lyrics_text

__all__ = [
    "Humanizer",
    "HumanizeConfig",
    "default_humanizer",
    "LyricsTimingManager",
    "LyricLine",
    "SongSection",
    "SongGenerator",
    "GenreProfile",
    "GENRE_PROFILES",
    "parse_lyrics_text",
]


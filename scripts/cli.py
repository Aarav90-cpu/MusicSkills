"""
MusicSkills - Command Line Interface
Generate complete songs with humanized MIDI arrangements and synchronized lyrical sheets.
"""

import argparse
import os
import sys

from scripts.humanizer import HumanizeConfig, Humanizer
from scripts.song_generator import GENRE_PROFILES, SongGenerator


def main() -> int:
    parser = argparse.ArgumentParser(
        description="MusicSkills Song Generator: Humanized MIDI Arrangements & Synchronized Lyrical Performance Guides."
    )
    parser.add_argument(
        "--topic",
        "-t",
        type=str,
        default="Cybernetic Horizon",
        help="Topic or lyrical theme of the song (default: 'Cybernetic Horizon')",
    )
    parser.add_argument(
        "--genre",
        "-g",
        type=str,
        default="pop",
        choices=list(GENRE_PROFILES.keys()),
        help=f"Musical genre ({', '.join(GENRE_PROFILES.keys())})",
    )
    parser.add_argument(
        "--mood",
        "-m",
        type=str,
        default="energetic",
        help="Mood: happy, sad, romantic, heartbroken, energetic, motivational, nostalgic, dark, aggressive, peaceful, mysterious, spiritual, cinematic, emotional",
    )
    parser.add_argument(
        "--purpose",
        "-p",
        type=str,
        default="workout music",
        help="Purpose: dance, party, workout, love, lullabies, devotional, wedding, festival, protest, storytelling, advertisement, background",
    )
    parser.add_argument(
        "--key",
        "-k",
        type=str,
        default="C",
        help="Musical key root note (C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B)",
    )
    parser.add_argument(
        "--bpm",
        type=int,
        default=None,
        help="Custom tempo in BPM (defaults to genre standard)",
    )
    parser.add_argument(
        "--jitter",
        type=int,
        default=7,
        help="Human timing jitter in ticks (+/- range, default: 7)",
    )
    parser.add_argument(
        "--velocity-variance",
        type=int,
        default=12,
        help="Human velocity variance (+/- range, default: 12)",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=str,
        default="outputs",
        help="Directory to save generated song assets (default: outputs)",
    )
    parser.add_argument(
        "--name",
        "-n",
        type=str,
        default=None,
        help="Base file name for outputs (defaults to sanitized topic name)",
    )
    parser.add_argument(
        "--list-styles",
        action="store_true",
        help="Display all supported genres, moods, purposes, and subgenres.",
    )

    args = parser.parse_args()

    if args.list_styles:
        print("\n=== MusicSkills Classification Matrix ===")
        print("\n1. Major Genres:")
        for k, v in GENRE_PROFILES.items():
            print(f"  - {k.ljust(14)}: {v.name} (BPM: ~{v.default_bpm}, Scale: {v.scale_type})")
        print("\n2. Popular Subgenres:")
        print("  Phonk (Drift, Brazilian, Memphis), R&B (Contemporary, Neo-Soul), Latin (Reggaeton, Salsa),")
        print("  African (Afrobeats, Amapiano), Japanese (City Pop, J-Rock), Korean (K-Pop), Ambient, Blues, Disco.")
        print("\n3. Moods:")
        print("  Happy, Sad, Romantic, Heartbroken, Energetic, Motivational, Nostalgic, Dark, Aggressive,")
        print("  Peaceful, Mysterious, Spiritual, Cinematic, Emotional.")
        print("\n4. Purposes:")
        print("  Dance, Party, Workout, Love, Lullabies, Devotional, Wedding, Festival, Protest, Storytelling,")
        print("  Advertisement, Background.")
        return 0

    base_name = args.name or args.topic.lower().replace(" ", "_").replace("'", "")
    # Clean characters
    base_name = "".join(c for c in base_name if c.isalnum() or c in ("_", "-"))

    cfg = HumanizeConfig(
        timing_jitter_min=-abs(args.jitter),
        timing_jitter_max=abs(args.jitter),
        velocity_variance=abs(args.velocity_variance),
    )
    humanizer = Humanizer(config=cfg)

    generator = SongGenerator(
        topic=args.topic,
        genre=args.genre,
        mood=args.mood,
        purpose=args.purpose,
        root_key=args.key,
        tempo_bpm=args.bpm,
        humanizer=humanizer,
    )

    print(f"\n🎵 Generating arrangement for: '{args.topic}'")
    print(f"   Genre: {generator.profile.name} | Mood: {generator.mood.capitalize()} | Purpose: {generator.purpose.capitalize()}")
    print(f"   Tempo: {generator.bpm} BPM | Key: {generator.root_key} {generator.profile.scale_type}")
    print(f"   Humanization: +/-{args.jitter} ticks jitter, +/-{args.velocity_variance} velocity dynamic swing")

    results = generator.generate_song(output_dir=args.output_dir, base_name=base_name)

    print("\n✅ Music generation complete! Generated assets:")
    print(f"   - Standard MIDI File    : {results['midi']}")
    print(f"   - Vocal Lead Sheet (MD) : {results['lead_sheet']}")
    print(f"   - Synced Lyrics (LRC)   : {results['lrc']}")
    print(f"   - Subtitle Cues (SRT)   : {results['srt']}")
    print(f"   - Timing JSON Map       : {results['json']}")
    print("\n💡 NOTE: Use .venv/bin/mido-play or your favorite DAW to play the MIDI file.")
    print("   Sing along with the precise timestamps provided in the Vocal Lead Sheet!\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())


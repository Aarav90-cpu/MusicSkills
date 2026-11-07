"""
MusicSkills - Command Line Interface
Generate complete songs with humanized MIDI arrangements and synchronized lyrical sheets.
"""

import argparse
import json
import os
import sys

from scripts.humanizer import HumanizeConfig, Humanizer
from scripts.song_generator import GENRE_PROFILES, SongGenerator, parse_lyrics_text, resolve_genre


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
        help=f"Musical genre ({', '.join(GENRE_PROFILES.keys())}) or subgenre",
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
        "--lyrics-file",
        "-l",
        type=str,
        default=None,
        help="Path to file containing AI-written lyrics (.json or .txt format with [Section] headers)",
    )
    parser.add_argument(
        "--lyrics-text",
        type=str,
        default=None,
        help="Raw string containing AI-written lyrics with [Section Name] headers",
    )
    parser.add_argument(
        "--lyrics-json",
        type=str,
        default=None,
        help="JSON string mapping sections to lyric lines, e.g. '{\"Verse 1\": [\"line 1\", \"line 2\"]}'",
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
    args.genre = resolve_genre(args.genre)

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

    # Parse custom AI-written lyrics if supplied
    ai_lyrics = None
    if args.lyrics_file:
        if not os.path.exists(args.lyrics_file):
            print(f"Error: Lyrics file not found: {args.lyrics_file}", file=sys.stderr)
            return 1
        with open(args.lyrics_file, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if args.lyrics_file.endswith(".json") or content.startswith("{"):
                ai_lyrics = json.loads(content)
            else:
                ai_lyrics = parse_lyrics_text(content)
    elif args.lyrics_json:
        ai_lyrics = json.loads(args.lyrics_json)
    elif args.lyrics_text:
        ai_lyrics = parse_lyrics_text(args.lyrics_text)

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
        lyrics=ai_lyrics,
        humanizer=humanizer,
    )

    lyrics_status = "Custom AI-written lyrics loaded" if ai_lyrics else "Instrumental arrangement (No lyrics provided)"
    print(f"\n[INFO] Generating arrangement for: '{args.topic}'")
    print(f"   Genre: {generator.profile.name} | Mood: {generator.mood.capitalize()} | Purpose: {generator.purpose.capitalize()}")
    print(f"   Tempo: {generator.bpm} BPM | Key: {generator.root_key} {generator.profile.scale_type}")
    print(f"   Vocal Track: {lyrics_status}")
    print(f"   Humanization: +/-{args.jitter} ticks jitter, +/-{args.velocity_variance} velocity dynamic swing")

    results = generator.generate_song(output_dir=args.output_dir, base_name=base_name)

    print("\n[SUCCESS] Music generation complete! Generated assets:")
    print(f"   - Standard MIDI File    : {results['midi']}")
    print(f"   - Vocal Lead Sheet (MD) : {results['lead_sheet']}")
    print(f"   - Synced Lyrics (LRC)   : {results['lrc']}")
    print(f"   - Subtitle Cues (SRT)   : {results['srt']}")
    print(f"   - Timing JSON Map       : {results['json']}")
    print("\n[NOTE] Use .venv/bin/mido-play or your favorite DAW to play the MIDI file.")
    print("   Sing along with the precise timestamps provided in the Vocal Lead Sheet!\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())


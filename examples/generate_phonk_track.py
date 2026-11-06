#!/usr/bin/env python3
"""
Example: Generate a Drift Phonk / Workout track with aggressive mood,
cowbell syncopation, humanized timing, and synchronized vocal cues.
"""

import os
import sys

# Ensure root directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.humanizer import HumanizeConfig, Humanizer
from scripts.song_generator import SongGenerator


def main():
    print("Generating Drift Phonk Workout Track: 'Midnight Drifter'...")
    cfg = HumanizeConfig(timing_jitter_min=-6, timing_jitter_max=6, velocity_variance=14)
    humanizer = Humanizer(config=cfg, seed=42)

    gen = SongGenerator(
        topic="Midnight Drifter",
        genre="phonk",
        mood="aggressive",
        purpose="workout music",
        root_key="D",
        tempo_bpm=136,
        humanizer=humanizer,
        seed=42,
    )

    outputs = gen.generate_song(output_dir="outputs/phonk_demo", base_name="midnight_drifter")
    print(f"Generated successfully in {outputs['midi']}")
    print(f"Lead sheet saved to {outputs['lead_sheet']}")


if __name__ == "__main__":
    main()

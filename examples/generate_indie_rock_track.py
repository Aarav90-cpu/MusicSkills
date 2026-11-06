#!/usr/bin/env python3
"""
Example: Generate an Indie Rock / Nostalgic Storytelling track with
dynamic overdrive guitars, driving bass, and introspective vocal timestamps.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.humanizer import HumanizeConfig, Humanizer
from scripts.song_generator import SongGenerator


def main():
    print("Generating Indie Rock Track: 'Coffee Shop in October'...")
    cfg = HumanizeConfig(timing_jitter_min=-8, timing_jitter_max=8, velocity_variance=12)
    humanizer = Humanizer(config=cfg, seed=101)

    gen = SongGenerator(
        topic="Coffee Shop in October",
        genre="rock",
        mood="nostalgic",
        purpose="storytelling songs",
        root_key="A",
        tempo_bpm=124,
        humanizer=humanizer,
        seed=101,
    )

    outputs = gen.generate_song(output_dir="outputs/rock_demo", base_name="coffee_shop_october")
    print(f"Generated successfully in {outputs['midi']}")
    print(f"Lead sheet saved to {outputs['lead_sheet']}")


if __name__ == "__main__":
    main()

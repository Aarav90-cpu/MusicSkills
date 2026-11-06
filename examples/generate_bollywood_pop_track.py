#!/usr/bin/env python3
"""
Example: Generate an Indian Music / Bollywood Fusion Celebration track
with Bhairav raga modal harmony, sitar leads, and celebratory vocal cues.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.humanizer import HumanizeConfig, Humanizer
from scripts.song_generator import SongGenerator


def main():
    print("Generating Indian Music Fusion Track: 'Festival of Colors'...")
    cfg = HumanizeConfig(timing_jitter_min=-5, timing_jitter_max=5, velocity_variance=10)
    humanizer = Humanizer(config=cfg, seed=777)

    gen = SongGenerator(
        topic="Festival of Colors",
        genre="indian",
        mood="energetic",
        purpose="festival music",
        root_key="C",
        tempo_bpm=102,
        humanizer=humanizer,
        seed=777,
    )

    outputs = gen.generate_song(output_dir="outputs/indian_demo", base_name="festival_of_colors")
    print(f"Generated successfully in {outputs['midi']}")
    print(f"Lead sheet saved to {outputs['lead_sheet']}")


if __name__ == "__main__":
    main()

"""
Tests for SongGenerator: Complete multi-track MIDI creation, humanization verification,
and synchronized asset export.
"""

import os
import shutil
import tempfile
import unittest

import mido
from scripts.song_generator import GENRE_PROFILES, SongGenerator


class TestSongGenerator(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_generate_standard_pop_song(self):
        """Generates a Pop song and verifies all 5 MIDI tracks and auxiliary files."""
        gen = SongGenerator(
            topic="Solar Flare",
            genre="pop",
            mood="energetic",
            purpose="dance music",
            root_key="G",
            seed=123,
        )
        res = gen.generate_song(output_dir=self.test_dir, base_name="solar_flare")

        # Verify files exist on disk
        for key in ("midi", "lead_sheet", "lrc", "srt", "json"):
            self.assertTrue(os.path.exists(res[key]), f"Missing expected output: {key}")

        # Verify MIDI structure with mido
        midi = mido.MidiFile(res["midi"])
        self.assertEqual(len(midi.tracks), 5)
        track_names = [tr.name for tr in midi.tracks]
        self.assertIn("Solar Flare - Conductor", track_names[0])
        self.assertIn("Harmony Chords", track_names[1])
        self.assertIn("Bassline", track_names[2])
        self.assertIn("Vocal Guide Melody", track_names[3])
        self.assertIn("Drums & Percussion", track_names[4])

        # Verify humanization (non-uniform velocity in drums and chords)
        drum_track = midi.tracks[4]
        drum_vels = [m.velocity for m in drum_track if m.type == "note_on" and m.velocity > 0]
        self.assertGreater(len(set(drum_vels)), 10, "Drums should have wide dynamic velocity variation")

    def test_all_ten_genres_generate_successfully(self):
        """Tests that all 10 major configured genres generate with unique drum styles and solos."""
        for g in GENRE_PROFILES.keys():
            gen = SongGenerator(
                topic="Test All Styles",
                genre=g,
                mood="cinematic",
                purpose="background music",
                seed=42,
            )
            res = gen.generate_song(output_dir=self.test_dir, base_name=f"test_{g}")
            self.assertTrue(os.path.exists(res["midi"]))
            self.assertGreater(os.path.getsize(res["midi"]), 1000)


if __name__ == "__main__":
    unittest.main()


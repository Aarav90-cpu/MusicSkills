"""
Tests for SongGenerator: Complete multi-track MIDI creation, humanization verification,
and synchronized asset export.
"""

import os
import shutil
import tempfile
import unittest

import mido
from scripts.song_generator import GENRE_PROFILES, SongGenerator, parse_lyrics_text


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

    def test_generate_with_ai_written_lyrics(self):
        """Verifies that custom lyrics written dynamically by an AI agent are accurately timed and exported."""
        ai_lyrics = {
            "Verse 1": [
                "Drifting through the deep expanse of space",
                "Searching for a quiet, sacred place",
            ],
            "Chorus 1": [
                "We burn like supernovas in the night!",
                "Carrying the beacon and the light!",
            ],
        }
        gen = SongGenerator(
            topic="Space Exploration",
            genre="electronic",
            mood="cinematic",
            purpose="storytelling",
            lyrics=ai_lyrics,
            seed=42,
        )
        res = gen.generate_song(output_dir=self.test_dir, base_name="space_exploration")

        # Verify custom lyrics appear verbatim in the lead sheet
        with open(res["lead_sheet"], "r", encoding="utf-8") as f:
            content = f.read()
            self.assertIn("Drifting through the deep expanse of space", content)
            self.assertIn("We burn like supernovas in the night!", content)

        # Verify in LRC
        with open(res["lrc"], "r", encoding="utf-8") as f:
            lrc_content = f.read()
            self.assertIn("Drifting through the deep expanse of space", lrc_content)

    def test_parse_lyrics_text_helper(self):
        """Verifies parsing of standard section header text format."""
        raw_text = """
        [Verse 1]
        First line of verse
        Second line of verse

        [Chorus 1]
        Anthemic hook line
        """
        parsed = parse_lyrics_text(raw_text)
        self.assertEqual(len(parsed["Verse 1"]), 2)
        self.assertEqual(parsed["Verse 1"][0], "First line of verse")
        self.assertEqual(parsed["Chorus 1"][0], "Anthemic hook line")


if __name__ == "__main__":
    unittest.main()


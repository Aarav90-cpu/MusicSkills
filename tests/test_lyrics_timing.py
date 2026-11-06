"""
Tests for LyricsTimingManager: Time calculation, formatting, and export formats.
"""

import json
import unittest
from scripts.lyrics_timing import LyricsTimingManager


class TestLyricsTiming(unittest.TestCase):

    def setUp(self):
        self.mgr = LyricsTimingManager(bpm=120.0, beats_per_bar=4, ticks_per_beat=480)

    def test_musical_to_real_world_seconds(self):
        """At 120 BPM in 4/4 time, 1 beat is 0.5s and 1 bar is 2.0s."""
        self.assertAlmostEqual(self.mgr.seconds_per_beat, 0.5)
        self.assertAlmostEqual(self.mgr.seconds_per_bar, 2.0)

        # Bar 4, Beat 2 = (4 * 2.0) + (2 * 0.5) = 9.0s
        self.assertAlmostEqual(self.mgr.bar_beat_to_seconds(4, 2.0), 9.0)

    def test_timestamp_formatting_no_rounding_overflow(self):
        """Verifies timestamp formatting never overflows milliseconds (e.g., no ',1000')."""
        ts = self.mgr.seconds_to_timestamp(65.432)
        self.assertEqual(ts, "01:05.432")

        # Edge case near boundary
        srt_ts = self.mgr.seconds_to_srt_timestamp(59.9999)
        self.assertTrue(srt_ts.endswith(",000") or srt_ts.endswith(",999") or srt_ts.startswith("00:01:00"))
        # Ensure millisecond portion is exactly 3 digits
        millis_part = srt_ts.split(",")[1]
        self.assertEqual(len(millis_part), 3)

    def test_section_and_line_registration(self):
        """Verifies section and line addition and timing bounds."""
        intro = self.mgr.add_section("Intro", "intro", start_bar=0, num_bars=4, energy_level="low")
        self.assertEqual(intro.start_seconds, 0.0)
        self.assertEqual(intro.end_seconds, 8.0)

        line = self.mgr.add_lyric_line(
            section=intro,
            text="Testing vocal entrance",
            bar_offset=1.0,
            beat_offset=0.0,
            duration_beats=2.0,
            pitch_guide="C4-E4",
        )
        self.assertEqual(line.start_seconds, 2.0)
        self.assertEqual(line.end_seconds, 3.0)

    def test_export_formats(self):
        """Verifies all export formats (MD, LRC, SRT, JSON) produce valid non-empty output."""
        sec = self.mgr.add_section("Chorus", "chorus", start_bar=0, num_bars=8, energy_level="high")
        self.mgr.add_lyric_line(sec, "Singing the hook loud", 0.0, 0.0, 3.0, "C5-G4")

        # Markdown
        md = self.mgr.export_lead_sheet_markdown("Demo Song", "Pop", "Energetic", "Dance")
        self.assertIn("# Demo Song - Vocal Lead Sheet & Timing Map", md)
        self.assertIn("Singing the hook loud", md)

        # LRC
        lrc = self.mgr.export_lrc()
        self.assertIn("[00:00.00]Singing the hook loud", lrc)

        # SRT
        srt = self.mgr.export_srt()
        self.assertIn("00:00:00,000 --> 00:00:01,500", srt)
        self.assertIn("Singing the hook loud", srt)

        # JSON
        raw_json = self.mgr.export_json()
        parsed = json.loads(raw_json)
        self.assertEqual(parsed["bpm"], 120.0)
        self.assertEqual(len(parsed["sections"]), 1)
        self.assertEqual(parsed["sections"][0]["lines"][0]["text"], "Singing the hook loud")


if __name__ == "__main__":
    unittest.main()


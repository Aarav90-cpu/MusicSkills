"""
Tests for Humanizer Engine: Timing jitter, dynamic velocity, duration variation.
"""

import unittest
from scripts.humanizer import HumanizeConfig, Humanizer


class TestHumanizer(unittest.TestCase):

    def setUp(self):
        self.cfg = HumanizeConfig(
            timing_jitter_min=-7,
            timing_jitter_max=7,
            velocity_variance=12,
        )
        self.humanizer = Humanizer(config=self.cfg, seed=42)

    def test_timing_jitter_generates_variance(self):
        """Verifies that time jitter prevents rigid grid alignment and produces distinct values."""
        base_time = 480
        results = [self.humanizer.humanize_time(base_time) for _ in range(100)]

        # Must produce multiple different values
        unique_vals = set(results)
        self.assertGreater(len(unique_vals), 5)

        # Must strictly stay within configured jitter bounds
        for val in results:
            self.assertGreaterEqual(val, base_time - 7)
            self.assertLessEqual(val, base_time + 7)

    def test_velocity_variance_and_bounds(self):
        """Verifies that velocity varies naturally and respects valid MIDI bounds [1, 127]."""
        base_vel = 95
        results = [self.humanizer.humanize_velocity(base_vel, beat_in_bar=0.0) for _ in range(100)]

        # Must not be uniform
        unique_vels = set(results)
        self.assertGreater(len(unique_vels), 5)

        # Boundary clamping tests
        super_low = self.humanizer.humanize_velocity(3, variance=10)
        self.assertGreaterEqual(super_low, 1)

        super_high = self.humanizer.humanize_velocity(125, variance=10)
        self.assertLessEqual(super_high, 127)

    def test_downbeat_accent_hierarchy(self):
        """Verifies downbeats (beat 0) receive higher average velocity than offbeats."""
        downbeats = [self.humanizer.humanize_velocity(80, beat_in_bar=0.0) for _ in range(50)]
        offbeats = [self.humanizer.humanize_velocity(80, beat_in_bar=0.5) for _ in range(50)]

        avg_down = sum(downbeats) / len(downbeats)
        avg_off = sum(offbeats) / len(offbeats)
        self.assertGreater(avg_down, avg_off)

    def test_duration_humanization(self):
        """Verifies duration humanization produces realistic legato and staccato deviations."""
        nominal = 400
        legato_vals = [self.humanizer.humanize_duration(nominal, style="legato") for _ in range(30)]
        staccato_vals = [self.humanizer.humanize_duration(nominal, style="staccato") for _ in range(30)]

        # Legato should be longer on average than nominal
        avg_legato = sum(legato_vals) / len(legato_vals)
        self.assertGreater(avg_legato, nominal)

        # Staccato should be shorter on average than nominal
        avg_staccato = sum(staccato_vals) / len(staccato_vals)
        self.assertLess(avg_staccato, nominal)


if __name__ == "__main__":
    unittest.main()


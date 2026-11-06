"""
MusicSkills - Humanizer Engine
Algorithms and utilities to introduce organic micro-fluctuations, human timing jitter,
dynamic velocity curves, and legato/staccato variation into MIDI event streams.

Prevents mathematically rigid quantization that triggers AI detection filters.
"""

from dataclasses import dataclass
import math
import random
from typing import Dict, List, Optional, Tuple


@dataclass
class HumanizeConfig:
    """Configuration parameters for organic humanization."""
    # Timing jitter in ticks (+/- range, e.g. -7 to 7 ticks for subtle human touch)
    timing_jitter_min: int = -7
    timing_jitter_max: int = 7
    # Velocity variance (+/- range around base velocity)
    velocity_variance: int = 12
    # Probability of human accentuation on strong beats (beats 1 and 3 in 4/4)
    downbeat_accent_boost: int = 8
    # Probability of offbeat human softness
    offbeat_dip: int = 5
    # Duration deviation percentage (-0.15 to +0.10 of nominal duration)
    duration_variance_min: float = -0.12
    duration_variance_max: float = 0.08
    # Micro-tempo drift frequency (in bars) and deviation in BPM
    tempo_drift_bpm: float = 0.75


class Humanizer:
    """Applies humanization transformations to MIDI note parameters."""

    def __init__(self, config: Optional[HumanizeConfig] = None, seed: Optional[int] = None):
        self.config = config or HumanizeConfig()
        self.rng = random.Random(seed)

    def humanize_time(self, base_ticks: int, jitter_range: Optional[Tuple[int, int]] = None, min_ticks: int = 0) -> int:
        """
        Applies a tiny timing jitter to prevent rigid grid quantization.

        Instead of perfect 0 delta time or exact grid ticks (e.g., 480):
            human_time = perfect_time + random.randint(-7, 7)
        """
        low, high = jitter_range or (self.config.timing_jitter_min, self.config.timing_jitter_max)
        jitter = self.rng.randint(low, high)
        result = base_ticks + jitter
        return max(min_ticks, result)

    def humanize_velocity(
        self,
        base_velocity: int,
        beat_in_bar: float = 0.0,
        variance: Optional[int] = None,
        curve: str = "natural",
    ) -> int:
        """
        Applies dynamic flavor to note velocities instead of a flat uniform number.

        Varies velocity dynamically and applies subtle organic accents on strong beats:
            human_velocity = base_velocity + random.randint(-12, 12)
            human_velocity = max(1, min(127, human_velocity))
        """
        v_range = variance if variance is not None else self.config.velocity_variance
        jitter = self.rng.randint(-v_range, v_range)

        # Natural beat hierarchy (metric accents)
        beat_mod = beat_in_bar % 4.0
        accent = 0
        if math.isclose(beat_mod, 0.0, abs_tol=0.1):  # Downbeat (Beat 1)
            accent = self.config.downbeat_accent_boost
        elif math.isclose(beat_mod, 2.0, abs_tol=0.1):  # Secondary beat (Beat 3)
            accent = self.config.downbeat_accent_boost // 2
        elif math.isclose(beat_mod % 1.0, 0.5, abs_tol=0.1):  # Off-beat
            accent = -self.config.offbeat_dip

        # Subtle sine wave breathing curve across musical phrases
        if curve == "sine":
            sine_wave = math.sin(beat_in_bar * math.pi / 4.0) * 4.0
            jitter += int(sine_wave)

        human_velocity = int(base_velocity + jitter + accent)
        # Ensure valid MIDI bounds (1 to 127, velocity 0 is note-off)
        return max(1, min(127, human_velocity))

    def humanize_duration(
        self,
        nominal_ticks: int,
        style: str = "natural",
        min_ticks: int = 24,
    ) -> int:
        """
        Humanizes note lengths so notes do not mathematically release at the exact
        microsecond the next one starts.

        Supports styles:
        - 'natural': subtle legato overlap or early cutoff (-12% to +8%)
        - 'staccato': deliberate light release (-35% to -15%)
        - 'legato': smooth lyrical overlap (+5% to +18%)
        """
        if style == "staccato":
            pct = self.rng.uniform(-0.35, -0.15)
        elif style == "legato":
            pct = self.rng.uniform(0.05, 0.18)
        else:
            pct = self.rng.uniform(self.config.duration_variance_min, self.config.duration_variance_max)

        duration = int(nominal_ticks * (1.0 + pct))
        return max(min_ticks, duration)

    def generate_tempo_drift(self, nominal_bpm: float, bar_index: int, total_bars: int) -> float:
        """
        Simulates natural human tempo fluctuation (rubato and heartbeat drift)
        across song sections (slight acceleration during chorus/climax, easing in outro).
        """
        # Slow organic wave
        slow_cycle = math.sin(2.0 * math.pi * bar_index / max(1, total_bars))
        drift = slow_cycle * self.config.tempo_drift_bpm + self.rng.uniform(-0.2, 0.2)
        return round(nominal_bpm + drift, 2)


# Default shared humanizer instance
default_humanizer = Humanizer()


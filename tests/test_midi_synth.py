"""
Tests for standalone MIDI to Audio Fallback Synthesizer.
Strictly zero-emoji.
"""

import os
import tempfile
import unittest
import wave

from scripts.midi_synth import render_midi_to_wav
from scripts.song_generator import SongGenerator


class TestMidiSynth(unittest.TestCase):
    def test_render_midi_to_wav(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Generate a small MIDI arrangement first
            gen = SongGenerator(topic="Synth Test", genre="electronic", tempo_bpm=120)
            res = gen.generate_song(output_dir=tmp_dir, base_name="synth_test")
            midi_path = res["midi"]
            self.assertTrue(os.path.exists(midi_path))

            # Synthesize WAV from MIDI
            wav_path = os.path.join(tmp_dir, "synth_test.wav")
            duration = render_midi_to_wav(midi_path, wav_path)

            self.assertTrue(os.path.exists(wav_path))
            self.assertGreater(duration, 0)

            # Validate WAV format (44.1kHz stereo 16-bit)
            with wave.open(wav_path, "rb") as wf:
                self.assertEqual(wf.getnchannels(), 2)
                self.assertEqual(wf.getsampwidth(), 2)
                self.assertEqual(wf.getframerate(), 44100)
                self.assertGreater(wf.getnframes(), 0)


if __name__ == "__main__":
    unittest.main()

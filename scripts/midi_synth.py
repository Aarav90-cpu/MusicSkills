"""
MusicSkills - Standalone MIDI to Audio Fallback Synthesizer
Synthesizes Standard MIDI (.mid) files into 44.1kHz stereo PCM WAV and MP3 masters
Zero external binary dependencies for WAV (uses Python standard library wave, math, struct)
Optionally encodes to MP3 via ffmpeg if available.
Strictly zero-emoji.
"""

import argparse
import math
import os
import struct
import subprocess
import sys
import wave

try:
    import mido
except ImportError:
    print("Error: mido is required for midi_synth.py", file=sys.stderr)
    sys.exit(1)


def midi_to_freq(note_num: int) -> float:
    """Convert MIDI note number (0-127) to frequency in Hz (A4 = 69 = 440Hz)."""
    return 440.0 * (2.0 ** ((note_num - 69) / 12.0))


def render_midi_to_wav(midi_path: str, wav_path: str, sample_rate: int = 44100) -> float:
    """Render MIDI file into a 16-bit stereo PCM WAV file."""
    mid = mido.MidiFile(midi_path)
    ticks_per_beat = mid.ticks_per_beat or 480
    current_tempo = 500000  # Default 120 BPM in microseconds per beat

    # 1. Parse all note events across all tracks with absolute time in seconds
    notes = []  # (start_sec, duration_sec, note, velocity, channel, track_name)

    for track in mid.tracks:
        current_time_ticks = 0
        active_notes = {}  # note_num -> (start_ticks, velocity, channel)
        t_name = track.name.lower() if track.name else "track"

        for msg in track:
            current_time_ticks += msg.time
            if msg.type == "set_tempo":
                current_tempo = msg.tempo
            elif msg.type == "note_on" and msg.velocity > 0:
                active_notes[msg.note] = (current_time_ticks, msg.velocity, msg.channel)
            elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                if msg.note in active_notes:
                    start_ticks, vel, ch = active_notes.pop(msg.note)
                    # Convert ticks to seconds
                    sec_per_tick = (current_tempo / 1_000_000.0) / ticks_per_beat
                    start_sec = start_ticks * sec_per_tick
                    dur_sec = max(0.05, (current_time_ticks - start_ticks) * sec_per_tick)
                    notes.append((start_sec, dur_sec, msg.note, vel, ch, t_name))

    if not notes:
        total_duration = 3.0
    else:
        total_duration = max(n[0] + n[1] for n in notes) + 1.0

    total_samples = int(total_duration * sample_rate)
    left_channel = [0.0] * total_samples
    right_channel = [0.0] * total_samples

    # 2. Synthesize note samples with polyphony and dynamic envelopes
    for start_sec, dur_sec, note_num, velocity, channel, t_name in notes:
        start_idx = int(start_sec * sample_rate)
        num_samples = int(dur_sec * sample_rate)
        if start_idx >= total_samples:
            continue

        end_idx = min(total_samples, start_idx + num_samples)
        freq = midi_to_freq(note_num)
        gain = (velocity / 127.0) * 0.22

        is_drum = channel == 9 or "drum" in t_name or "perc" in t_name
        is_bass = "bass" in t_name or note_num < 48

        for idx in range(start_idx, end_idx):
            t = (idx - start_idx) / sample_rate
            # ADSR envelope: 15ms attack, exponential decay/sustain
            env = min(1.0, t / 0.015) * math.exp(-2.2 * (t / dur_sec))

            if is_drum:
                # Drum synthesis: Kick, Snare, Hi-hat emulation
                if note_num in (35, 36):  # Bass Drum / Kick
                    pitch = 140.0 * math.exp(-22.0 * t) + 45.0
                    val = math.sin(2.0 * math.pi * pitch * t) * env * 1.4
                    pan_l, pan_r = 0.5, 0.5
                elif note_num in (38, 40):  # Snare
                    tone = math.sin(2.0 * math.pi * 180.0 * t) * 0.4
                    noise = (math.sin(t * 123456.7) % 1.0 - 0.5) * 0.8
                    val = (tone + noise) * env * 1.1
                    pan_l, pan_r = 0.55, 0.45
                else:  # Hi-hat / Cymbals
                    noise = (math.sin(t * 987654.3) % 1.0 - 0.5)
                    val = noise * env * 0.5
                    pan_l, pan_r = 0.4, 0.6
            elif is_bass:
                # Bass: rich fundamental sine + sub-octave triangle
                val = (math.sin(2.0 * math.pi * freq * t) * 0.75 +
                       math.sin(2.0 * math.pi * (freq * 0.5) * t) * 0.35) * env * gain * 1.3
                pan_l, pan_r = 0.5, 0.5
            else:
                # Polyphonic melody/harmony: warm bandlimited tone with subtle detune
                val = (math.sin(2.0 * math.pi * freq * t) * 0.65 +
                       math.sin(2.0 * math.pi * (freq * 2.01) * t) * 0.25 +
                       math.sin(2.0 * math.pi * (freq * 3.0) * t) * 0.1) * env * gain
                pan_l, pan_r = 0.48, 0.52

            left_channel[idx] += val * pan_l
            right_channel[idx] += val * pan_r

    # 3. Peak normalization and master limiting to prevent clipping
    max_peak = 0.0001
    for s in range(total_samples):
        max_peak = max(max_peak, abs(left_channel[s]), abs(right_channel[s]))

    norm_factor = 28000.0 / max_peak if max_peak > 0.85 else 32000.0

    # 4. Write 16-bit PCM stereo WAV
    os.makedirs(os.path.dirname(os.path.abspath(wav_path)), exist_ok=True)
    with wave.open(wav_path, "wb") as wav_out:
        wav_out.setnchannels(2)
        wav_out.setsampwidth(2)
        wav_out.setframerate(sample_rate)

        frames = bytearray()
        for s in range(total_samples):
            l_val = int(max(-32767, min(32767, left_channel[s] * norm_factor)))
            r_val = int(max(-32767, min(32767, right_channel[s] * norm_factor)))
            frames.extend(struct.pack("<hh", l_val, r_val))

        wav_out.writeframes(frames)

    return total_duration


def main():
    parser = argparse.ArgumentParser(description="Standalone MIDI to Audio Fallback Synthesizer")
    parser.add_argument("--midi", "-m", required=True, help="Input Standard MIDI (.mid) file")
    parser.add_argument("--output", "-o", required=True, help="Output destination (.wav or .mp3)")
    parser.add_argument("--bitrate", "-b", default="192k", help="MP3 bitrate (default: 192k)")
    args = parser.parse_args()

    midi_path = os.path.abspath(args.midi)
    out_path = os.path.abspath(args.output)

    if not os.path.exists(midi_path):
        print(f"Error: MIDI file '{midi_path}' not found.", file=sys.stderr)
        sys.exit(1)

    if out_path.endswith(".mp3"):
        wav_temp = out_path.replace(".mp3", "_temp.wav")
        duration = render_midi_to_wav(midi_path, wav_temp)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", wav_temp, "-b:a", args.bitrate, out_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if os.path.exists(wav_temp):
                os.unlink(wav_temp)
            print(f"[SUCCESS] Synthesized MP3 master: {out_path} ({duration:.2f}s)")
        except Exception as e:
            # Fall back to renaming WAV to output if ffmpeg fails
            if os.path.exists(wav_temp):
                os.replace(wav_temp, out_path)
            print(f"[FALLBACK] Saved audio to {out_path}: {e}")
    else:
        duration = render_midi_to_wav(midi_path, out_path)
        print(f"[SUCCESS] Synthesized WAV master: {out_path} ({duration:.2f}s)")


if __name__ == "__main__":
    main()


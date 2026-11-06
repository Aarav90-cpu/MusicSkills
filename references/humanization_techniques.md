# Humanization Techniques: Avoiding Algorithmic AI Detection

Modern audio analysis tools and human listeners can instantly detect AI-generated music by identifying unnatural mathematical perfection. Real human musicians never perform with laser-guided mechanical precision. Organic performance is defined by micro-imperfections, emotional dynamic phrasing, and physical inertia.

---

## What Triggers AI Detection Flags

### 1. Perfect Quantization
- **The Issue**: Every single note-on and note-off event falls exactly on the grid line ($t = 0\text{ ms}$ delta deviation).
- **Why It Flags**: In physics, human muscle response and mechanical instrument resistance have inherent latency variance ($\pm 3\text{ to }15\text{ ms}$). Zero variance is mathematically impossible for a human player.

### 2. Uniform Velocity
- **The Issue**: Every note in a track is struck with identical velocity (e.g. `velocity=100` across all notes).
- **Why It Flags**: Real fingers, picks, and drumsticks strike with varying force. Even an expert drummer playing a steady backbeat will fluctuate between 98 and 114 velocity, with intentional accents on downbeats.

### 3. Lack of Micro-Fluctuations & Breath
- **The Issue**: Perfectly flat tempo curves across an entire 3-minute arrangement with no breathing pauses or natural phrase decay.
- **Why It Flags**: Human musicians subtly push tempo during high-energy choruses (+0.5 to +1.5 BPM) and pull back during intros, bridges, or ballads (rubato).

---

## The Three Core Humanization Fixes

### 1. Introduce Human Timing Jitter
Do not allow notes to trigger on mathematically exact ticks. Apply a minute human variance using Python's `random` module:

```python
import random

# Instead of a rigid grid delta (e.g., exactly 480 ticks)
perfect_time = 480

# Inject subtle human variance (+/- 1 to 7 ticks in 480 TPB resolution)
human_time = perfect_time + random.randint(-7, 7)

# Guard against negative delta ticks
human_time = max(0, human_time)
```

**Tick-to-Millisecond Reference Table (at 120 BPM, 480 Ticks/Beat):**
- 1 beat = 500 ms = 480 ticks
- 1 tick $\approx$ 1.04 ms
- $\pm 7\text{ ticks} \approx \pm 7.28\text{ ms}$ (The sweet spot: natural human groove without sounding sloppy).

---

### 2. Vary Velocity Dynamically
Real musicians naturally emphasize the strong beats of a measure (metric accents) while letting offbeats breathe. Velocity should follow a dynamic distribution:

```python
import random

# Add human dynamic flavor to note velocities instead of a flat 100
base_velocity = 95
human_velocity = base_velocity + random.randint(-12, 12)

# Ensure velocity stays strictly within valid MIDI bounds (1-127)
human_velocity = max(1, min(127, human_velocity))
```

#### Metric Beat Hierarchy in 4/4 Time:
- **Beat 1 (Downbeat)**: Heaviest physical strike ($+6\text{ to }+10$ velocity boost).
- **Beat 2 (Backbeat)**: Snare anchor ($+4\text{ to }+8$ velocity).
- **Beat 3 (Secondary Downbeat)**: Medium strike ($+2\text{ to }+5$ velocity).
- **Beat 4 (Backbeat)**: Snare anchor ($+4\text{ to }+8$ velocity).
- **Eighth / Sixteenth Offbeats**: Softer ghost notes ($-4\text{ to }-10$ velocity reduction).

---

### 3. Humanize Note Lengths (Legato / Staccato)
When humans play melodic or chordal instruments, notes rarely cut off at the exact microsecond the next note begins.

```python
import random

nominal_duration = 440  # Ticks

# For legato / lyrical singing: allow slight natural overlap (+5% to +15%)
legato_duration = int(nominal_duration * (1.0 + random.uniform(0.05, 0.15)))

# For staccato / rhythmic funk: allow clean early release (-15% to -30%)
staccato_duration = int(nominal_duration * (1.0 - random.uniform(0.15, 0.30)))
```

---

## 4. Organic Groove & Swing Offsets

In genres like Hip-Hop (Boom Bap), Jazz, Reggae, and House, the even-numbered 16th notes (the "and" or offbeats) are delayed to create swing:

$$\Delta t_{\text{swung}} = \text{base\_ticks} + (\text{swing\_factor} \times \text{ticks\_per\_subdivision})$$

Where a standard `swing_factor` of $0.08\text{ to }0.16$ creates the authentic head-nodding bounce typical of human drummers.

---

## Implementation Summary in Python `mido`

```python
import mido
from mido import Message, MidiFile, MidiTrack
from scripts.humanizer import Humanizer

humanizer = Humanizer()

# Creating a humanized note event
track = MidiTrack()
note_pitch = 60  # Middle C

# 1. Humanized time jitter
delta_time = humanizer.humanize_time(480, jitter_range=(-6, 6))

# 2. Dynamic velocity with downbeat weighting
velocity = humanizer.humanize_velocity(92, beat_in_bar=0.0, variance=10)

# 3. Humanized duration
duration = humanizer.humanize_duration(440, style="legato")

track.append(Message("note_on", note=note_pitch, velocity=velocity, time=delta_time))
track.append(Message("note_off", note=note_pitch, velocity=0, time=duration))
```


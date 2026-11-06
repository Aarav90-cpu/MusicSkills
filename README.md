# MusicSkills 🎵

> [!IMPORTANT]
> **DISCLAIMER**: **This library does NOT generate vocals or synthetic speech audio!**  
> It generates complete, multi-track musical backing arrangements in Standard MIDI (`.mid`) format and produces syllable-synchronized lyrical performance sheets with millisecond-accurate timestamps (`[MM:SS.mmm]`) for human vocalists or external vocal synthesizers (such as Synthesizer V, Vocaloid, ACE Studio, or CeVIO) to sing along with.

An agentic AI songwriting, composition, and humanization toolkit built for **Claude (Primary)**, **Google Gemini**, and **OpenAI ChatGPT**.

---

## Overview

Writing great music with AI requires moving beyond robotic, mechanically aligned notes. `MusicSkills` provides:
1. **Thematic Song Generation**: Composes complete songs on any topic, key, and tempo.
2. **Synchronized Lyrical Lead Sheets**: Generates lyrics with exact timestamps (`[MM:SS.mmm]`) for when to sing each phrase, complete with pitch guides and vocal dynamic markings.
3. **Multi-Track Standard MIDI Generation**: Produces 5 coordinated MIDI tracks (Conductor, Chords Harmony, Bassline, Vocal Guide Melody, Drums & Percussion).
4. **Anti-AI Detection Humanization**: Eliminates rigid computer quantization by injecting micro-timing jitter ($\pm 1\text{ to }7\text{ ticks}$), metric velocity dynamics ($\pm 12$), and legato/staccato duration drift.
5. **Multi-Format Export**: Generates `.mid` (Standard MIDI), `.md` (Singer's Lead Sheet), `.lrc` (Synced Karaoke), `.srt` (Subtitles), and `.json` (Timing Map).

---

## Installation & Environment Setup

This project uses a dedicated Python virtual environment and the `mido` MIDI library.

```bash
# 1. Create a Python virtual environment
python3 -m venv --system-site-packages .venv

# 2. Activate the virtual environment
source .venv/bin/activate

# 3. Install mido and required tools
pip install -r requirements.txt
```

Verify the installation of `mido` CLI tools:
```bash
.venv/bin/mido-play --help
.venv/bin/mido-ports
```

---

## Quick Start & Usage

### 1. Command Line Interface (CLI)

Generate a complete song arrangement with lyrics and timestamps in a single command:

```bash
# Generate a Dark Phonk workout track on "Night Drifter"
.venv/bin/python -m scripts.cli \
  --topic "Night Drifter" \
  --genre phonk \
  --mood dark \
  --purpose "workout music" \
  --key D \
  --bpm 136

# Generate an Indie Rock storytelling track on "October Rain"
.venv/bin/python -m scripts.cli \
  --topic "October Rain" \
  --genre rock \
  --mood nostalgic \
  --purpose "storytelling songs" \
  --key A

# Generate an Indian Fusion festival track on "Colors of Spring"
.venv/bin/python -m scripts.cli \
  --topic "Colors of Spring" \
  --genre indian \
  --mood energetic \
  --purpose "festival music" \
  --key C \
  --bpm 104
```

### 2. Python API (AI Writes Custom Lyrics)

The AI model (Claude, Gemini, or ChatGPT) writes custom, original lyrics and passes them directly to the engine:

```python
from scripts.humanizer import HumanizeConfig, Humanizer
from scripts.song_generator import SongGenerator

# 1. Configure organic humanization
cfg = HumanizeConfig(
    timing_jitter_min=-7,
    timing_jitter_max=7,
    velocity_variance=12,
)
humanizer = Humanizer(config=cfg)

# 2. Supply original lyrics written by the AI model:
ai_lyrics = {
    "Verse 1": [
        "In the quiet of the morning when the rain begins to fall",
        "I can hear the distant engine answer to the highway call",
    ],
    "Chorus 1": [
        "We are running through the starlight, nothing left to lose",
        "Breaking past the shadows and the midnight blues",
    ],
}

# 3. Initialize song generator with AI-written lyrics
generator = SongGenerator(
    topic="Voyage to the Deep",
    genre="electronic",
    mood="mysterious",
    purpose="background music",
    root_key="F",
    tempo_bpm=124,
    lyrics=ai_lyrics,  # Custom lyrics supplied by the AI!
    humanizer=humanizer,
)

# 4. Generate multi-track MIDI arrangement and vocal lead sheet
outputs = generator.generate_song(output_dir="outputs", base_name="voyage_to_deep")

print("Generated MIDI File:", outputs["midi"])
print("Vocal Lead Sheet:   ", outputs["lead_sheet"])
print("Synced LRC File:    ", outputs["lrc"])
```

---

## 7 Core Musical Sections

Every song follows a professional emotional and architectural curve across 7 primary sections:

| Section | Standard Bars | Energy | Musical & Vocal Purpose |
|---|---|---|---|
| **Intro** | 4 – 8 | Low | Establishes tempo, key, harmonic progression, and atmospheric vibe. |
| **Verse** | 8 – 16 | Medium | Tells the story; intimate vocal register, clean harmonic accompaniment. |
| **Pre-Chorus** | 4 – 8 | Med-High | The "Lift" building tension; rising chord progression, accelerating drums. |
| **Chorus** | 8 – 16 | High (Climax) | The emotional anchor and unforgettable melodic hook; maximum power (**ff**). |
| **Bridge** | 4 – 8 | Contrast | Perspective shift; altered chord progression, breakdown or vocal falsetto. |
| **Instrumental Break** | 4 – 8 | High | Solo showcase (electric guitar, synth lead, sitar, or cowbell riff). |
| **Outro** | 4 – 8 | Low | Resolution; repeating hook motif fading or decaying into silence. |

---

## Musical Styles, Genres & Classification

Music is structured across **5 orthogonal dimensions**:

$$\text{Song Identity} = \text{Genre} + \text{Mood} + \text{Purpose} + \text{Instrumentation} + \text{Vocal Delivery}$$

### 1. Major Music Genres
1. **Pop**: Catchy melodies, memorable hooks, mainstream appeal (Dance Pop, Synth-Pop, Electropop, Teen Pop).
2. **Hip-Hop / Rap**: Rhythmic vocals, beats, wordplay, and flow (Trap, Drill, Boom Bap, Conscious Rap).
3. **Rock**: Guitars, drums, powerful vocals, energy (Classic Rock, Hard Rock, Punk Rock, Alternative Rock, Indie Rock).
4. **Electronic / EDM**: Synthesizers, electronic percussion, sound design (House, Techno, Trance, Dubstep, Drum and Bass, Future Bass).
5. **Jazz**: Improvisation, complex harmonies, expressive instruments (Bebop, Swing, Smooth Jazz, Fusion).
6. **Classical**: Orchestras, compositions, intricate arrangements (Baroque, Romantic, Opera, Symphony).
7. **Country / Folk**: Storytelling, acoustic instruments, cultural roots (Bluegrass, Americana, Country Pop, Folk Rock).
8. **Indian Music**: Traditional ragas, regional styles, modern fusion (Hindustani Classical, Carnatic, Bollywood, Qawwali, Ghazal, Bhangra).
9. **Reggae / Caribbean**: Offbeat rhythms, distinctive grooves (Ska, Dancehall, Dub, Roots Reggae).
10. **Metal**: Heavy guitars, aggressive instrumentation, powerful vocals (Heavy Metal, Death Metal, Metalcore, Symphonic Metal).

### 2. Other Popular Styles & Subgenres
- **Phonk**: Drift Phonk, Brazilian Phonk, Memphis Phonk.
- **R&B**: Contemporary R&B, Neo-Soul, Alternative R&B.
- **Latin**: Reggaeton, Salsa, Bachata, Merengue.
- **African**: Afrobeats, Amapiano, Highlife.
- **Japanese**: J-Pop, J-Rock, City Pop.
- **Korean**: K-Pop, K-R&B.
- **Ambient**: Dark Ambient, Space Ambient, Drone.
- **Blues**: Delta Blues, Chicago Blues.
- **Disco**: Nu-Disco, Italo Disco.
- **Experimental**: Glitch, IDM, Noise.

### 3. Mood Classification
`Happy`, `Sad`, `Romantic`, `Heartbroken`, `Energetic`, `Motivational`, `Nostalgic`, `Dark`, `Aggressive`, `Peaceful`, `Mysterious`, `Spiritual`, `Cinematic`, `Emotional`.

### 4. Purpose Classification
`Dance music`, `Party music`, `Workout music`, `Love songs`, `Lullabies`, `Devotional songs`, `Wedding songs`, `Festival music`, `Protest songs`, `Storytelling songs`, `Advertisement jingles`, `Background music`.

### Example Dimensional Combinations:
- `Dark Phonk` + `Brazilian Funk` + `Aggressive` + `Night Drive / Workout` + `Distorted 808 Cowbell`
- `Indie Rock` + `Nostalgic` + `Storytelling` + `Jangle Telecaster Guitar` + `Intimate Baritone`
- `Bollywood Fusion` + `Romantic / Energetic` + `Wedding Dance` + `Sitar & Dhol Drums`

---

## Anti-AI Detection & Humanization

Mathematical perfection flags music as AI-generated. Human performance is naturally organic, expressive, and slightly imperfect.

### What to Avoid:
1. **Perfect Quantization**: Note-on and note-off events locked to a grid with zero millisecond deviations.
2. **Uniform Velocity**: All notes sharing identical velocity (e.g. flat 100).
3. **Lack of Micro-Fluctuations**: Flat tempo with no organic tempo drift or human breathing room.

### How MusicSkills Fixes It:
1. **Human Timing Jitter**:
   ```python
   # Apply natural micro-jitter to prevent rigid delta times
   perfect_time = 480
   human_time = max(0, perfect_time + random.randint(-7, 7))
   ```
2. **Dynamic Velocity Variation**:
   ```python
   # Inject dynamic flavor and downbeat accents (1-127 valid MIDI bounds)
   base_velocity = 95
   human_velocity = max(1, min(127, base_velocity + random.randint(-12, 12)))
   ```
3. **Humanize Note Lengths (Legato / Staccato)**:
   - Legato melodies naturally overlap slightly ($+5\%\text{ to }+15\%$).
   - Staccato rhythms release slightly early ($-15\%\text{ to }-30\%$).

---

## Synchronized Lyrics & Vocal Lead Sheets

MusicSkills calculates precise real-world seconds from musical beats:

$$\text{Seconds Per Bar} = \frac{240}{\text{BPM}} \quad (\text{in 4/4 time})$$

Sample generated Vocal Lead Sheet:

```markdown
### [00:28.444 - 00:42.667] CHORUS 1 (Bars 17–24)
*Energy Level: High*

- **[00:28.444 -> 00:30.000]** This is our time, living for Neon Rain! | Key/Notes: `C5-B4-A4-G4`, Dynamic: **ff**, Style: *Anthemic, explosive vocal hook*
- **[00:30.222 -> 00:31.778]** Nothing can hold us down, we break the atmospheric blue | Key/Notes: `E4-G4-A4-C5`, Dynamic: **ff**, Style: *Hold long sustain*
- **[00:32.000 -> 00:33.556]** Feel the thunder roll, a fire in the heart | Key/Notes: `D5-C5-B4-A4`, Dynamic: **ff**, Style: *Passionate vibrato*
```

---

## Testing & Quality Assurance

Run the automated test suite with pytest:

```bash
.venv/bin/python -m pytest tests/ -v
```

All 10 unit and integration tests validate timing jitter, dynamic velocity bounds, millisecond formatting, and multi-track MIDI generation.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](file:///home/aarav/MusicSkills/LICENSE) file for details.


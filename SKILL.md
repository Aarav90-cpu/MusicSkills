---
name: music-song-creation
description: Professional AI song creation toolkit for Claude, Gemini, and ChatGPT. Generates humanized multi-track MIDI arrangements with mido, avoids algorithmic AI detection with natural timing jitter and velocity dynamics, and outputs timestamped lyrical lead sheets with exact singing cues.
---

# Music Song Creation Skill

An elite AI agent capability package for designing, composing, arranging, and producing complete musical songs on any topic, across all major genres, moods, and purposes.

This skill is designed for **Claude (Primary)**, **Google Gemini**, and **OpenAI ChatGPT**.

> **MANDATORY DISCLAIMER**: This library and skill do **NOT** generate synthetic audio vocals or AI speech. It generates complete, production-ready musical backing arrangements in Standard MIDI (`.mid`) format using `mido`, alongside millisecond-synchronized lyrical performance lead sheets (`[MM:SS.mmm]`), synced karaoke files (`.lrc`), subtitle files (`.srt`), and JSON timing maps for human vocalists or external vocal synthesizers (e.g. Synthesizer V, Vocaloid, ACE Studio) to sing.

---

## Directory Architecture: What is Where

```
MusicSkills/
├── SKILL.md                          # Primary agent instruction, activation rules, and architecture map (this file)
├── README.md                         # User documentation, installation guide, disclaimer, and CLI tutorial
├── LICENSE                           # Official MIT License
├── requirements.txt                  # Python dependencies (mido>=1.3.0)
├── .gitignore                        # Git ignore patterns (.venv, cache, generated outputs)
├── references/                       # In-depth technical documentation for agents & producers
│   ├── song_structure_guide.md       # Comprehensive breakdown of all 7 song sections, energy curves, & bars
│   ├── genres_and_styles.md          # 10 major genres, subgenres, 14 moods, 12 purposes, & dimensional formula
│   ├── humanization_techniques.md    # Anti-AI detection math: timing jitter, dynamic velocity, legato/staccato
│   └── lyrical_timestamping.md       # Conversion formulas (BPM to seconds), breathing cues, and lyric formats
├── scripts/                          # Production-ready executable Python engine
│   ├── __init__.py                   # Module exports
│   ├── humanizer.py                  # Humanization algorithms (jitter, dynamic velocity, natural duration drift)
│   ├── lyrics_timing.py              # Timestamp generator (lead sheets, LRC, SRT, JSON)
│   ├── song_generator.py             # Core generator (harmony, bass, vocal guide melody, drums -> Standard MIDI)
│   └── cli.py                        # User-friendly CLI utility (`python -m scripts.cli`)
├── server/                           # Full-Stack Express backend with Vercel AI SDK & Audio Engine
│   ├── index.ts                      # Express server + Vite middleware dev integration (port 3000)
│   ├── ai.ts                         # Vercel AI SDK integration (Claude, Gemini, OpenAI, local fallback)
│   ├── audio.ts                      # FluidSynth & FFmpeg 192k MP3 synthesis and vocal mixdown
│   ├── chats.ts                      # Local storage manager (.chats/{name}-{id}/)
│   └── config.ts                     # System settings and API credential management
├── src/                              # Material 3 Dark Studio frontend (React 19 + TypeScript + Vite)
│   ├── App.tsx                       # Primary studio router
│   ├── main.tsx                      # Application mount
│   ├── components/                   # Modular studio components (AppShell, PersistentPlayer, ActivityPanel, Waveform)
│   ├── pages/                        # Studio views (Welcome, Setup, Home, ChatCreation, VocalStudio, Iterate, Settings)
│   ├── context/                      # Global AppContext (theme, audio player, activity events, chats)
│   ├── styles/                       # Material 3 tokens & Dark Studio palette (--color-bg: #0F0E15)
│   └── types/                        # Complete TypeScript contracts
├── examples/                         # Ready-to-run demonstration scripts
│   ├── __init__.py
│   ├── generate_phonk_track.py       # Brazilian/Drift Phonk workout track with cowbells & dark mood
│   ├── generate_indie_rock_track.py  # Indie Rock nostalgic storytelling track with overdrive guitars
│   └── generate_bollywood_pop_track.py # Indian pop festival celebration track with sitar & Bhairav modal harmony
└── tests/                            # Rigorous automated test suite (100% pass rate)
    ├── __init__.py
    ├── test_humanizer.py             # Tests jitter variance, velocity bounds [1-127], metric accents
    ├── test_lyrics_timing.py         # Tests BPM-to-seconds conversions, millisecond boundaries, export formats
    └── test_song_generator.py        # Tests end-to-end multi-track MIDI generation & mido parsing
```

---

## When to Activate This Skill

Activate this skill whenever the user asks to:
1. Write, compose, or produce a song about a specific topic, concept, or story.
2. Generate a musical arrangement or MIDI file using Python or `mido`.
3. Provide lyrics with exact singing timestamps (`[MM:SS.mmm]`) synchronized to a musical tempo and bar structure.
4. Compose music in a specific genre (Pop, Rock, Hip-Hop, Phonk, EDM, Indian Classical/Bollywood, Jazz, Metal, Country, Reggae, Latin, etc.).
5. Apply humanization techniques to prevent music from sounding robotic or being flagged as mathematically generated AI music.
6. Create synced lyrical lead sheets, `.lrc` files, or `.srt` subtitle files for vocal performance.

### When NOT to Activate
- Tasks requesting direct rendering of raw `.wav` or `.mp3` audio synthesis without MIDI or songwriting instructions.
- Audio speech synthesis / voice cloning requests (instruct the user that this skill exports vocal pitch guides and timing sheets for human singers or vocal synthesizers).

---

## 1. The 7 Core Song Sections

Every song composed by the agent must follow a coherent emotional narrative arc structured across these 7 primary sections:

1. **Intro (4–8 Bars | Low Energy)**:
   - Sets the key, master tempo, harmonic progression, and atmospheric vibe.
   - Typically instrumental, ambient pads, light arpeggios, or spoken/whispered vocal cues.
2. **Verse (8–16 Bars | Medium Energy)**:
   - Delivers the narrative context, intimate exposition, and character perspective.
   - Lower vocal register, conversational phrasing, uncluttered harmonic accompaniment.
3. **Pre-Chorus (4–8 Bars | Medium-High Energy)**:
   - The "Lift" or build-up that creates musical tension leading into the hook.
   - Ascending chord progressions, accelerating rhythmic pulse, rising vocal pitch contour.
4. **Chorus (8–16 Bars | Maximum Energy & Climax)**:
   - The thematic center, emotional anchor, and unforgettable melodic hook of the song.
   - Full instrumentation, anthemic power vocal delivery (**ff**), highest pitch range.
5. **Bridge (4–8 Bars | Contrasting Energy)**:
   - Breaks the repetitive cycle with a new harmonic progression or perspective shift.
   - Stripped-back arrangement (breakdown) or intimate falsetto, building into the final climax.
6. **Instrumental Break (4–8 Bars | High Groove / Solo)**:
   - Showcases instrumental virtuosity and sonic texture (guitar solo, synth drop, sitar run, cowbell break).
7. **Outro (4–8 Bars | Decay / Resolution)**:
   - Gradually strips elements away, repeating the core hook softly into a decay or fade-out.

*For complete arrangement guidelines, refer to [references/song_structure_guide.md](file:///home/aarav/MusicSkills/references/song_structure_guide.md).*

---

## 2. Style, Genre, Mood & Dimensional Composition

Never classify music into a single rigid tag. Construct musical identity across **5 distinct dimensions**:

$$\text{Song Identity} = \text{Genre} + \text{Mood} + \text{Purpose} + \text{Instrumentation} + \text{Vocal Delivery}$$

### Dimension 1: Major Music Genres
1. **Pop**: Catchy melodies, memorable hooks, mainstream appeal (Dance Pop, Synth-Pop, Electropop, Teen Pop).
2. **Hip-Hop / Rap**: Rhythmic vocals, beats, wordplay, and flow (Trap, Drill, Boom Bap, Conscious Rap).
3. **Rock**: Overdriven guitars, acoustic drums, driving bass, raw vocal energy (Classic Rock, Hard Rock, Punk Rock, Alternative Rock, Indie Rock).
4. **Electronic / EDM**: Synthesizers, build-ups, dynamic drops (House, Techno, Trance, Dubstep, Drum and Bass, Future Bass).
5. **Jazz**: Improvisation, complex extended chords, swung rhythms (Bebop, Swing, Smooth Jazz, Fusion).
6. **Classical**: Intricate arrangements, counterpoint, wide dynamic range (Baroque, Romantic, Opera, Symphony).
7. **Country / Folk**: Storytelling, cultural roots, acoustic instruments (Bluegrass, Americana, Country Pop, Folk Rock).
8. **Indian Music**: Traditional ragas, talas, regional fusion (Hindustani Classical, Carnatic, Bollywood, Qawwali, Ghazal, Bhangra).
9. **Reggae / Caribbean**: Offbeat skank chords, syncopated basslines, one-drop drums (Ska, Dancehall, Dub, Roots Reggae).
10. **Metal**: High-gain guitars, blast beats, aggressive vocal belting/growls (Heavy Metal, Death Metal, Metalcore, Symphonic Metal).

### Dimension 2: Other Popular Styles & Subgenres
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

### Dimension 3: Mood Classification
`Happy`, `Sad`, `Romantic`, `Heartbroken`, `Energetic`, `Motivational`, `Nostalgic`, `Dark`, `Aggressive`, `Peaceful`, `Mysterious`, `Spiritual`, `Cinematic`, `Emotional`.

### Dimension 4: Purpose Classification
`Dance music`, `Party music`, `Workout music`, `Love songs`, `Lullabies`, `Devotional songs`, `Wedding songs`, `Festival music`, `Protest songs`, `Storytelling songs`, `Advertisement jingles`, `Background music`.

*For comprehensive genre breakdowns, scales, and BPM tables, refer to [references/genres_and_styles.md](file:///home/aarav/MusicSkills/references/genres_and_styles.md).*

---

## 3. Anti-AI Detection & Humanization Protocols

To prevent generated music from sounding like robotic math or being flagged by audio AI detectors, apply these strict rules:

### What to Avoid:
1. **Perfect Quantization**: Never place all note-on and note-off events at $t = 0\text{ ms}$ grid alignment.
2. **Uniform Velocity**: Never use flat velocities like `100` across an entire track.
3. **Lack of Micro-Fluctuations**: Avoid completely rigid, unvarying tempo across the song.

### Humanization Fixes to Apply:
1. **Introduce Human Timing Jitter**:
   ```python
   import random
   # Instead of perfect 480 ticks:
   perfect_time = 480
   human_time = max(0, perfect_time + random.randint(-7, 7))
   ```
2. **Vary Velocity Dynamically**:
   ```python
   # Apply natural variance and downbeat metric accents:
   base_velocity = 95
   human_velocity = base_velocity + random.randint(-12, 12)
   human_velocity = max(1, min(127, human_velocity))
   ```
3. **Humanize Note Lengths (Legato / Staccato)**:
   - For lyrical melodies: allow slight natural overlap ($+5\%\text{ to }+15\%$).
   - For staccato / funk rhythm: allow crisp early release ($-15\%\text{ to }-30\%$).

*For the complete mathematical specification, refer to [references/humanization_techniques.md](file:///home/aarav/MusicSkills/references/humanization_techniques.md).*

---

## 4. Vocal Timestamping & Phrasing Methodology

To enable a singer or vocal synthesizer to match the music, calculate real-world time from musical bars:

$$\text{Seconds Per Beat} = \frac{60.0}{\text{BPM}}$$
$$\text{Seconds Per Bar} = \frac{240.0}{\text{BPM}} \quad (\text{in 4/4 time})$$
$$\text{Start Time}(s) = (\text{Bar} \times \text{Seconds Per Bar}) + (\text{Beat} \times \text{Seconds Per Beat})$$

### Output Formats Produced:
1. **Singer's Lead Sheet (`.md`)**:
   Provides section timestamp bounds, line timestamp ranges `[MM:SS.mmm -> MM:SS.mmm]`, pitch guide recommendations (`C4-E4-G4`), dynamic markings (`pp`, `mf`, `f`, `ff`), and vocal delivery instructions (e.g. *Airy breath, push on final word*).
2. **Synced Karaoke Format (`.lrc`)**:
   Standard line-by-line format for karaoke players and media players.
3. **SubRip Subtitles (`.srt`)**:
   Standard millisecond subtitle cues for video overlays.
4. **Timing Map (`.json`)**:
   Structured JSON for programmatic ingestion.

*For complete conversion math, refer to [references/lyrical_timestamping.md](file:///home/aarav/MusicSkills/references/lyrical_timestamping.md).*

---

## 5. Agent Workflow: Fulfilling User Requests

When a user asks for a song, execute the following procedure:

1. **Clarify or Extract Inputs**:
   - Topic (e.g., "Midnight coding", "Space exploration", "Lost love")
   - Genre & Subgenre (e.g., Phonk, Indie Rock, Bollywood, Synth-Pop)
   - Mood (e.g., Dark, Energetic, Nostalgic, Romantic)
   - Purpose (e.g., Workout, Storytelling, Dance, Party)
   - Musical Key & Tempo (or use genre defaults)

2. **The AI Writes the Original Lyrics**:
   - You (Claude, Gemini, or ChatGPT) actively write the song lyrics using your language intelligence, adhering to the structure outlined in [references/song_structure_guide.md](file:///home/aarav/MusicSkills/references/song_structure_guide.md) and stylistic conventions in [references/genres_and_styles.md](file:///home/aarav/MusicSkills/references/genres_and_styles.md).
   - Write distinct sections: `Verse 1`, `Pre-Chorus`, `Chorus 1`, `Verse 2`, `Chorus 2`, `Bridge`, `Chorus 3 (Climax)`, and `Outro`.
   - Ensure the syllable count is rhythmic and singable.

3. **Generate Musical Arrangement & Synchronize Vocal Sheet**:
   - Pass your written lyrics into `SongGenerator` in Python:
     ```python
     from scripts.song_generator import SongGenerator

     # Lyrics written dynamically by the AI agent:
     ai_lyrics = {
         "Verse 1": [
             "First original line written by the AI",
             "Second line continuing the story",
         ],
         "Chorus 1": [
             "Anthemic chorus hook line",
             "Second line of the chorus",
         ],
     }

     generator = SongGenerator(
         topic="YOUR_TOPIC",
         genre="GENRE",
         mood="MOOD",
         purpose="PURPOSE",
         lyrics=ai_lyrics,  # Custom lyrics supplied by the AI!
     )
     outputs = generator.generate_song(output_dir="outputs", base_name="my_song")
     ```
   - Or pass via the CLI using `--lyrics-text` or `--lyrics-file`:
     ```bash
     .venv/bin/python -m scripts.cli \
       --topic "YOUR_TOPIC" \
       --genre "GENRE" \
       --lyrics-file "lyrics.txt"
     ```

4. **Present the Results to the User**:
   - Display the complete singer's lead sheet with exact `[MM:SS.mmm]` vocal entrance cues, pitch guides, and dynamic markings.
   - Explain how to listen to the backing arrangement via `.venv/bin/mido-play <file.mid>` or any DAW (Ableton, FL Studio, Logic, Reaper).
   - Reiterate the disclaimer that the MIDI contains the backing track and vocal pitch guide for human singers or vocal synths.

---

## 6. Execution Environment & Dependencies

- **Virtual Environment**: `.venv` located in workspace root.
- **Python Version**: Python 3.10+ (supports modern Python 3.14).
- **Core Library**: `mido>=1.3.0` (with bundled tools `mido-play`, `mido-ports`, `mido-connect`, `mido-serve`).
- **Tests Execution**: `.venv/bin/python -m pytest tests/ -v` (12 automated unit/integration tests).
- **Web Studio (Full-Stack UI)**:
  - Powered by **Vercel AI SDK (`ai`)**, **Google Material 3 (`@material/web` tokens & Material Icons)**, and **FluidSynth + FFmpeg**.
  - Default: **Dark Studio Mode (`#0F0E15`)** prioritized.
  - Launch with `npm run dev` at `http://localhost:3000`.
  - Features 5-step song creation, live vocal recording with teleprompter and metronome count-in, A/B auditioning deck, and 100% local-first storage in `.chats/`.



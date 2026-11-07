# MusicSkills

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

## System Requirements & External Dependencies

MusicSkills Studio combines Python algorithmic MIDI synthesis, FluidSynth soundfont rendering, and FFmpeg audio transcoding.

### 1. Prerequisites by Operating System

| Tool | Purpose | Ubuntu / Debian | Arch Linux | macOS (Homebrew) |
| :--- | :--- | :--- | :--- | :--- |
| **Python 3** (>= 3.10) | MIDI composition, humanization, theory calculations | `sudo apt install python3 python3-pip python3-venv` | `sudo pacman -S python python-pip` | `brew install python` |
| **FFmpeg** | WAV to MP3 transcoding, vocal mixing, Remotion rendering | `sudo apt install ffmpeg` | `sudo pacman -S ffmpeg` | `brew install ffmpeg` |
| **FluidSynth** | Software SoundFont synthesizer rendering MIDI to audio | `sudo apt install fluidsynth` | `sudo pacman -S fluidsynth` | `brew install fluidsynth` |
| **SoundFonts** | General MIDI instrument samples (`FluidR3_GM.sf2`) | `sudo apt install fluid-soundfont-gm` | `sudo pacman -S soundfont-fluid` | `brew install fluid-soundfont` |
| **Chromium** *(Optional)* | Headless video rendering for Remotion music videos | `sudo apt install chromium` | `sudo pacman -S chromium` | `brew install --cask chromium` |
| **Node.js** (>= 18) | Full-stack web studio, Vercel AI SDK, Material 3 UI | `sudo apt install nodejs npm` | `sudo pacman -S nodejs npm` | `brew install node` |

---

## Installation & Environment Setup

This project uses a dedicated Python virtual environment for MIDI synthesis and Node.js for the studio web interface.

```bash
# 1. Create a Python virtual environment
python3 -m venv --system-site-packages .venv

# 2. Activate the virtual environment
source .venv/bin/activate

# 3. Install mido and Python MIDI tools
pip install -r requirements.txt

# 4. Install studio web application dependencies
npm install

# 5. Start the full-stack MusicSkills Studio
npm run dev
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

## MusicSkills Web Studio (Full-Stack UI)

MusicSkills includes a full-stack local web studio powered by **Vercel AI SDK (`ai`)**, **Google Material 3 (`@material/web` tokens & Material Icons)**, and **FluidSynth + FFmpeg local audio rendering**.

### Launching the Studio

```bash
# 1. Install frontend and server dependencies
npm install

# 2. Launch the dev server (Express backend + Vite frontend on port 3000)
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Key Studio Features

1. **Dark Studio Mode Default**: Deep dark palette (`#0F0E15`) designed specifically for low-light DAW rooms and live performance booths.
2. **2026 Frontier AI Model Integration**:
   - **Anthropic (Claude)**: Claude Opus 5.5 (Flagship), Claude Sonnet 5.5 (Default Premier), Claude Fable 5.1, Claude Haiku 5.5.
   - **OpenAI (GPT)**: GPT-5.5, GPT-6.1, GPT-6 Astra.
   - **Google (Gemini)**: Gemini 4 Argon, Gemini 3.1 Pro Preview, Gemini 3 Flash Preview.
3. **100% Guaranteed AI Lyrics Engine**:
   - Multi-format resilient parser (normalizes markdown headers, asterisks, colons, bullets).
   - Automatic retry with temperature backoff.
   - Instant procedural offline fallbacks for all 10 genres (Pop, Hip-Hop, Rock, Electronic, Jazz, Classical, R&B, Country, Reggae, Metal) so lyric generation never fails even without network connectivity or API credentials.
4. **Sanitized GitHub Auto-Reporting & Diagnostics**:
   - One-click bug reporting with automatic credential redaction (strips Bearer tokens, OpenAI, Anthropic, and Gemini keys).
   - Pre-fills environment specs (OS, Browser, Screen resolution, Model, Provider, SoundFont status).
   - Integrated into the real-time Activity Panel and Settings Support Hub.
5. **5-Step Song Creation Wizard**:
   - *Step 1 (Style)*: Topic, genre, mood, purpose, tempo (BPM), key/scale, and 7-section structure timeline.
   - *Step 2 (Lyrics)*: Dynamic AI lyric authoring with live rhyming controls, syllable estimation, and section editing.
   - *Step 3 (Review)*: Side-by-side verification of lyrics, energy contours, and bar ranges.
   - *Step 4 (Generate)*: Humanized multi-track MIDI compilation and FluidSynth 192k MP3 synthesis.
   - *Step 5 (Result)*: Karaoke lyrics player with real-time waveform visualization, vocal teleprompter, and download suite.
6. **Live Vocal Recording Studio**:
   - Microphone hardware selector and live AudioContext RMS VU level meter.
   - 4-beat pulsing count-in metronome with audio ticks.
   - Synchronized scrolling teleprompter with pitch guide ribbons.
   - Multi-take recording reel (`take-1`, `take-2`, etc.) saved to `.chats/{name}-{id}/vocals/`.
   - Mixdown & mastering console: vocal level, backing level, studio reverb, and sync offset compensation.
7. **Iterative Arrangement & A/B Testing**:
   - Conversational AI co-writing chat dock for iterative arrangement prompts.
   - A/B instant auditioning deck: switch between versions on-the-fly to compare mixdowns.
8. **Stage Scrolling Lyrics & Live Teleprompter**:
   - Dedicated full-screen stage teleprompter view with line-by-line smooth vertical auto-centering.
   - Active line highlighted with neon specular glow, dynamic energy badges, and text pop animations.
   - Interactive click-to-seek playback jumping: click any lyric line to instantly scrub audio to that timestamp.
   - Configurable font sizing (Normal, Large, Extra Large), auto-follow toggle, and timing offset calibration ($\pm 0.2\text{s}$).
9. **Interactive Real-Time Lyrics Syncer & LRCLIB Integration**:
   - Real-time line-by-line audio synchronization: press the **ENTER** key while listening to stamp timestamps. Spacebar controls play/pause without conflicting!
   - LRCLIB search and one-click fetch: download synchronized `.lrc` and plain lyrics directly from lrclib.net.
   - Precision timestamp nudging ($\pm 0.1\text{s}$ / $\pm 0.5\text{s}$) with live line previews.
   - Export directly to standard synchronized `.lrc` (karaoke) and `.srt` (subtitles) or save back to the active project.
10. **Custom Song Pairing & Project Import/Export**:
   - Pair any external custom audio file (`.mp3`, `.wav`, `.ogg`, `.m4a`) with an `.lrc` file or raw lyrics for immediate scrolling playback.
   - "Save as Library Project" option saves custom pairings into `.chats/` as first-class studio projects.
   - Universal project import and export handling: download self-contained `.zip` archives containing all MIDI arrangements, rendered audio, lead sheets, vocal takes, and chat history.
11. **In-Studio Python Engine Editor & Subprocess Runner**:
   - View, edit, and run Python music generation scripts directly from the browser (`/code`).
   - Integrated subprocess console displaying real-time execution logs, exit codes, and stdout/stderr.
12. **Floating AI Producer Assistant (Code Diff Accept/Deny)**:
   - Floating corner chat box that can be minimized or maximized to full screen.
   - Proposes code and arrangement modifications with line count diff cards (`+X / -Y lines`), expandable code previews, and one-click "Accept Changes" or "Deny" actions.
13. **Remotion + Three.js 3D Music Video Studio**:
   - Dedicated music video workstation (`/video`) with live WebGL 3D audio-reactive visualizer and Remotion-style timeline controller (frames, playhead, 4 multi-track layers).
   - Dual-mode workflow: switch seamlessly between **Timeline Preview** and **Composition Code** to customize Three.js shaders and particles.
14. **Studio Analytics & Music Player (Playlists, Favorites, Token Tracking)**:
   - Dedicated player analytics dashboard (`/stats`): tracks listening time, composing/coding time, and AI model token consumption.
   - Full music player suite: create custom playlists, group by albums/artists, and manage favorite tracks.
15. **Local-First & Private**:
   - All projects, audio takes, stems, and MIDI files are kept locally in `.chats/`. Cross-platform dynamic path resolution with zero hardcoded paths.
16. **External AI Agent Bridge & Unified CLI (`musicskills`)**:
   - First-class support for **Claude Code** (`claude`), **Codex CLI** (`codex`), and **Google Antigravity** (`agy`).
   - Real-time Server-Sent Events (SSE) watcher ensures everything created by external terminal agents instantly syncs into the web studio without manual reloading.
   - The floating AI assistant can spin up background agent sessions for Claude Code and Codex directly from the browser, streaming live terminal logs and registering generated artifacts.

---

## External AI Agents & Unified CLI (`musicskills`)

External AI agents (such as **Claude Code**, **Codex CLI**, or **Google Antigravity**) operate in external terminal sessions. MusicSkills provides a unified CLI and real-time Server-Sent Events (SSE) synchronization engine so that external AI creations immediately appear in the web studio.

### 1. Unified `musicskills` CLI Commands

Use `musicskills` (or `./bin/musicskills`) to manipulate studio projects from any terminal or AI agent session:

```bash
# Check system environment, SoundFonts, and detected AI agents
musicskills status

# List all studio projects and their version counts
musicskills list
musicskills list --json

# Create a registered studio project in .chats/
musicskills new-project --name "Neon Horizon" --genre "synthwave" --bpm 128 --key "D"

# Generate a multi-track MIDI arrangement and 192k MP3 audio
musicskills generate --id "neon-horizon-abc123" --genre "synthwave" --bpm 128

# Attach AI-written lyrics and compute millisecond timestamps
musicskills add-lyrics --id "neon-horizon-abc123" --file "lyrics.txt"

# Generate reactive 3D Remotion video animation code
musicskills remotion --id "neon-horizon-abc123" --prompt "Neon grid tunnel with reactive audio bloom"

# Create a section-specific cover or remix (e.g. Rock breakdown for Chorus)
musicskills cover --id "neon-horizon-abc123" --section "Chorus" --prompt "Heavy distorted guitars with double-time drums"

# Inspect full project details and version history
musicskills show --id "neon-horizon-abc123"
```

### 2. Real-Time Two-Way Studio Synchronization

- **Live SSE Watcher**: The backend monitors `.chats/` and `outputs/`. Whenever an external CLI tool or Python script generates `.mid`, `.lrc`, or video code, the web studio updates in real time via Server-Sent Events (`/api/events`).
- **Auto-Intake Outputs**: Any standalone `.mid` or `.lrc` created in `outputs/` is automatically imported as a registered studio project with zero manual configuration.

### 3. In-Studio External Agent Sessions (Claude Code & Codex)

From the web studio Floating Chat Box:
1. Click the AI Engine selector and choose **Claude Code CLI** or **Codex CLI**.
2. Enter your songwriting or arrangement instructions.
3. The studio spins up a background agent process, streams terminal stdout/stderr logs in real time, and automatically registers generated artifacts (MIDI files, MP3 renders, lead sheets, Remotion video compositions) as actionable cards in the studio.

---

## Community Governance & Issue Reporting

MusicSkills strictly complies with a **Zero-Emoji Policy** across all code, documentation, and user interfaces.

* **[Code of Conduct](CODE_OF_CONDUCT.md)**: Contributor Covenant v2.1 guidelines.
* **[Contributing Guide](CONTRIBUTING.md)**: Development workflows, testing standards, and pull request procedures.
* **[Security Policy](SECURITY.md)**: Vulnerability disclosure, local credential protection, and subprocess safety.
* **[Issue Templates](.github/ISSUE_TEMPLATE/)**:
  * [Bug Report](.github/ISSUE_TEMPLATE/bug_report.yml)
  * [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml)
  * [Song Genre Request](.github/ISSUE_TEMPLATE/song_genre_request.yml)
  * [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md)

---

## Testing & Quality Assurance

Run the automated test suite with pytest:

```bash
.venv/bin/python -m pytest tests/ -v
```

All 12 unit and integration tests validate timing jitter, dynamic velocity bounds, millisecond formatting, and multi-track MIDI generation.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](file:///home/aarav/MusicSkills/LICENSE) file for details.


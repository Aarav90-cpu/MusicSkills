# Contributing to MusicSkills

Thank you for your interest in contributing to MusicSkills! We welcome contributions from developers, musicians, and audio engineers.

> **IMPORTANT DISCLAIMER**: This library and studio do NOT generate synthetic audio vocals. It generates multi-track Standard MIDI arrangements, SoundFont synthesis (192kbps MP3 via FluidSynth and FFmpeg), and millisecond-accurate singing lead sheets for human vocalists and vocal synthesizers.

---

## Zero-Emoji Policy

This repository adheres to a strict **zero-emoji policy** across all codebase files, comments, commit messages, documentation, and user interfaces. Use Google Material Icons (`material-icons-round`, `material-icons-outlined`) or clean semantic text tokens instead.

---

## Development Environment Setup

MusicSkills consists of a core Python composition engine and a modern React 19 + TypeScript + Express full-stack web studio.

### 1. Prerequisites

- Python 3.10+ (supports Python 3.14)
- Node.js 18+ (tested on Node.js v26+)
- FluidSynth (`/usr/bin/fluidsynth`) and FFmpeg (`/usr/bin/ffmpeg`)
- SoundFont file (e.g. `/usr/share/soundfonts/FluidR3_GM.sf2`)

### 2. Python Environment Setup

```bash
# Create virtual environment
python3 -m venv --system-site-packages .venv

# Activate environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Verify the installation:
```bash
.venv/bin/python -m pytest tests/ -v
```

### 3. Node.js Full-Stack Setup

```bash
# Install frontend and server dependencies
npm install

# Run type check
npx tsc --noEmit

# Test production build
npm run build

# Start local development studio (port 3000)
npm run dev
```

---

## Architecture Overview

- `scripts/`: Production-ready Python modules:
  - `humanizer.py`: Micro-timing jitter (plus/minus 7 ticks), dynamic velocity variations, and duration drift.
  - `lyrics_timing.py`: Millisecond timestamping formulas and format exporters (Lead Sheet, LRC, SRT, JSON).
  - `song_generator.py`: 5-track multi-track Standard MIDI arranger.
  - `cli.py`: Command line interface (`music-song-gen`).
- `server/`: Express backend integrating Vercel AI SDK (`ai`), FluidSynth audio rendering, and local `.chats/` management.
- `src/`: React 19 frontend implementing Material 3 tokens with Dark Studio Mode prioritized as default.
- `references/`: Complete technical guides for song structures, genres, humanization math, and lyric timing.
- `tests/`: Automated unit and integration tests.

---

## How to Add a New Genre Profile

To add a new genre (e.g., Synthwave or Afrobeat):

1. **Update Genre Profile**:
   Add the genre specification in `scripts/song_generator.py` under `GENRE_PROFILES`. Define default BPM, time signature, modal scale, instrumentation, and drum pattern.
2. **Update Documentation**:
   Add the genre classification and dimensional formula to `references/genres_and_styles.md`.
3. **Add Fallback Lyrics**:
   Add authentic genre-specific lyric templates in `server/ai.ts` under `generateLocalFallbackLyrics`.
4. **Add Automated Tests**:
   Add test coverage in `tests/test_song_generator.py`. Verify with `.venv/bin/python -m pytest tests/ -v`.

---

## Coding Standards

### Python Standards
- Adhere to PEP 8 guidelines.
- Use explicit type annotations on all function and method signatures.
- Ensure integer arithmetic is used for millisecond calculations to prevent floating point rounding overflows.
- Ensure all MIDI velocities remain bounded within the valid General MIDI range of [1, 127].

### TypeScript Standards
- Enable strict mode in `tsconfig.json`.
- Avoid `any` types; define explicit interfaces in `src/types/index.ts`.
- Ensure dark mode (`#0F0E15`) remains the primary, prioritized theme across all CSS variables and UI components.
- Run `npx tsc --noEmit` and `npm run build` prior to committing.

---

## Pull Request Process

1. **Fork the repository** and create a feature branch (`git checkout -b feature/new-genre-profile`).
2. **Implement changes** following the zero-emoji policy and coding standards.
3. **Run tests**:
   ```bash
   .venv/bin/python -m pytest tests/ -v
   npx tsc --noEmit
   npm run build
   ```
4. **Commit with Conventional Commits** (e.g., `feat: add afrobeat genre profile`, `fix: correct srt timestamp boundary`).
5. **Submit your Pull Request** referencing the relevant issue number and completing the PR template checklist.

# Lyrical Timestamping & Vocal Performance Synchronization

To perform or record vocals over an AI-assisted musical arrangement, a singer or external vocal synthesizer needs exact temporal landmarks. A lyric sheet without timestamps leaves the singer guessing when to breathe, enter, hold, or resolve phrases.

---

## The Mathematics of Musical Time Conversion

All temporal calculations originate from the master tempo in **Beats Per Minute (BPM)** and the time signature (standard 4/4):

$$\text{Seconds Per Beat} = \frac{60}{\text{BPM}}$$

$$\text{Seconds Per Bar (Measure)} = \text{Seconds Per Beat} \times \text{Beats Per Bar} = \frac{60 \times 4}{\text{BPM}} = \frac{240}{\text{BPM}}$$

### Elapsed Seconds Formula:

$$\text{Time}(t) = \left(\text{Bar Number} \times \frac{240}{\text{BPM}}\right) + \left(\text{Beat Offset} \times \frac{60}{\text{BPM}}\right)$$

### Reference Table: Elapsed Time per Bar

| BPM | 1 Beat (Quarter Note) | 1 Bar (4 Beats) | 4 Bars (Intro / Pre-Chorus) | 8 Bars (Verse / Chorus) | 16 Bars (Double Section) |
|---|---|---|---|---|---|
| **75 BPM** | 0.800 s | 3.200 s | 12.800 s | 25.600 s | 51.200 s |
| **88 BPM** | 0.682 s | 2.727 s | 10.909 s | 21.818 s | 43.636 s |
| **105 BPM** | 0.571 s | 2.286 s | 9.143 s | 18.286 s | 36.571 s |
| **120 BPM** | 0.500 s | 2.000 s | 8.000 s | 16.000 s | 32.000 s |
| **128 BPM** | 0.469 s | 1.875 s | 7.500 s | 15.000 s | 30.000 s |
| **135 BPM** | 0.444 s | 1.778 s | 7.111 s | 14.222 s | 28.444 s |
| **145 BPM** | 0.414 s | 1.655 s | 6.621 s | 13.241 s | 26.483 s |

---

## Lyrical Phrasing & Breathing Principles

1. **Breathing Windows**:
   - Human lungs require between 0.35 s and 0.60 s to take an inaudible, relaxed diaphragmatic breath.
   - Never place lyrical lines continuously back-to-back without leaving at least a half-bar or quarter-bar rest for inhalation.

2. **Syllable Density**:
   - Fast tempos (130+ BPM): Maximize single-syllable Anglo-Saxon words or syncopated rhyme bursts.
   - Slower tempos (70-95 BPM): Longer melismatic vowels (vocal vibrato holds).

3. **Vocal Dynamic Markings**:
   - $\mathbf{pp}$ (*pianissimo*): Whispered, intimate tone.
   - $\mathbf{p}$ (*piano*): Soft, conversational verse delivery.
   - $\mathbf{mf}$ (*mezzo-forte*): Firm, confident storytelling tone.
   - $\mathbf{f}$ (*forte*): Powerful chest voice, pre-chorus climb.
   - $\mathbf{ff}$ (*fortissimo*): Anthemic chorus belt, full harmonic projection.

---

## Export Formats Supported

### 1. Singer's Lead Sheet (Markdown)
The most practical format for human vocalists:
```markdown
### [00:28.444 - 00:42.667] CHORUS 1 (Bars 17–24)
*Energy Level: High*

- **[00:28.444 -> 00:30.000]** This is our time, living for Neon Rain! | Key/Notes: `C5-B4-A4-G4`, Dynamic: **ff**, Style: *Anthemic, explosive vocal hook*
- **[00:30.222 -> 00:31.778]** Nothing can hold us down, we break the atmospheric blue | Key/Notes: `E4-G4-A4-C5`, Dynamic: **ff**, Style: *Hold long sustain*
```

### 2. Synced LRC (.lrc)
Standard for media players (VLC, Spotify lyric formats, mobile karaoke players):
```lrc
[00:28.44]This is our time, living for Neon Rain!
[00:30.22]Nothing can hold us down, we break the atmospheric blue
```

### 3. SubRip Subtitles (.srt)
Standard for video editors (Premiere, DaVinci Resolve, Final Cut, CapCut, YouTube):
```srt
7
00:00:28,444 --> 00:00:30,000
This is our time, living for Neon Rain!
```

### 4. Structured JSON (.json)
Structured schema for automated downstream tools, web apps, or AI agent pipelines.


# Security Policy

## Supported Versions

Security updates are applied to the following versions of MusicSkills:

| Version | Supported |
| :--- | :--- |
| 1.0.x | Yes |
| < 1.0 | No |

---

## Reporting a Vulnerability

The MusicSkills project team takes security and user privacy seriously. If you discover a security vulnerability, please do NOT disclose it publicly on GitHub issues or community forums.

### Reporting Procedure

1. **Email Details**: Send a description of the vulnerability to `security@musicskills.local` or submit a private report through GitHub Private Vulnerability Reporting.
2. **Include Details**:
   - Description of the issue and potential impact
   - Minimal steps or proof-of-concept to reproduce the vulnerability
   - Affected platform and environment version
3. **Acknowledgment**: You will receive an acknowledgment within 48 hours.
4. **Resolution**: The team will provide a timeline for verification, patch development, and advisory publication.

---

## Privacy & Credential Security Guidelines

### 1. Local-First Architecture
MusicSkills is designed from the ground up as a **local-first application**:
- All generated MIDI files, rendered MP3s, vocal takes, and chat message histories reside solely in the local `.chats/` directory.
- No audio files, vocal recordings, or musical compositions are transmitted to external servers or telemetry systems.

### 2. API Key Management
- API keys (Anthropic, OpenAI, Google Gemini) are stored strictly on your local machine in `.config.json`.
- `.config.json` is explicitly included in `.gitignore` to prevent accidental commits to public version control.
- In the Studio UI and diagnostic reports, API keys are always masked (e.g. `••••••••1234`) and automatically redacted from error traces and GitHub diagnostic reports.

### 3. Local Audio Rendering & Subprocess Safety
- The audio engine invokes `fluidsynth` and `ffmpeg` using parameter lists rather than interpolated shell strings, eliminating shell command injection risks.
- Audio file access is scoped strictly to designated project paths within `.chats/`.

---

## Zero-Emoji Standard

In accordance with project-wide guidelines, all security communications, advisories, and documentation strictly adhere to the zero-emoji policy.


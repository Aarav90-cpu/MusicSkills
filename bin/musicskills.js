#!/usr/bin/env node
/**
 * MusicSkills - External AI & Agent CLI Bridge
 * Unified command-line interface for Claude Code, Codex, Antigravity, and developers.
 * Allows external AI agents to create projects, generate humanized arrangements,
 * write/sync lyrics, render Remotion animations, and stream updates directly into the Studio.
 * Strictly zero-emoji.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listChats, getChat, createChat, saveChat, sanitizeName, getChatsDir } from '../server/chats';
import { renderSong } from '../server/audio';
import { loadConfig } from '../server/config';
import { parseLyricsOutput, fetchLRCLibReference } from '../server/ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse flags from process.argv
function parseArgs(args) {
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

// Help message
function printHelp() {
  console.log(`
MusicSkills External Agent CLI
Autonomous bridge for Claude Code, Codex, Antigravity, and Terminal Producers.

Usage:
  ./bin/musicskills <command> [options]
  musicskills <command> [options]

Commands:
  new-project, create         Create a new project session registered in MusicSkills Studio
  generate                    Compose MIDI arrangement, humanize, render MP3 audio, and save version
  add-lyrics, lyrics          Attach AI-written or baseline lyrics and calculate vocal timings
  cover, remix                Branch a section-specific cover or genre variation (e.g. Phonk drop)
  remotion, video             Generate or save reactive 3D Remotion video animation code
  list                        List all active studio projects and their version counts
  show                        Inspect detailed project metadata, lyrics, and assets
  fetch-lyrics                Query and cache synchronized lyrics from LRCLIB for a project
  status                      Check local render dependencies, SoundFonts, and external AI agents

Options:
  --project-id, -p <id>       Target project ID (e.g. 7f3a9b)
  --name, -n, --title <str>   Song title (default: "Untitled Song")
  --genre, -g <str>           Genre: pop, rock, hip-hop, electronic, phonk, indian, jazz, country, reggae, metal
  --mood, -m <str>            Mood: energetic, dark, melancholic, chill, uplifting, romantic
  --purpose <str>             Purpose: workout music, dance, driving, storytelling, festival
  --bpm <num>                 Tempo in BPM (e.g. 128)
  --key, -k <str>             Musical root key (e.g. C, Am, F#, Eb)
  --lyrics-file <path>        Path to text or JSON lyrics file
  --lyrics-text <text>        Raw text containing lyrics with [Section] headers
  --style <str>               Video style for Remotion (e.g. 3d-tunnel, waveform, minimal)
  --json                      Format CLI output as JSON for external agent parsing
  --help, -h                  Show this documentation
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || args.help || args.h) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'new-project':
      case 'create': {
        const title = args.name || args.title || args.n || args._[1] || 'New Track';
        const genre = args.genre || args.g || 'pop';
        const mood = args.mood || args.m || 'energetic';
        const purpose = args.purpose || 'workout music';
        const bpm = args.bpm ? parseInt(args.bpm, 10) : 120;
        const key = args.key || args.k || 'C';
        const description = args.description || args.d || `Created via External Agent CLI (${genre} - ${mood})`;

        const newChat = createChat(title, {
          topic: title,
          description,
          genre,
          moods: [mood],
          purposes: [purpose],
          bpm,
          key,
          scale: genre === 'pop' || genre === 'country' ? 'major' : 'minor',
          vocalDelivery: 'singer',
        });

        if (args.json) {
          console.log(JSON.stringify({
            success: true,
            project: {
              id: newChat.id,
              name: newChat.name,
              folderName: newChat.folderName,
              genre: newChat.style.genre,
              bpm: newChat.style.bpm,
              key: newChat.style.key,
              path: path.join(getChatsDir(), newChat.folderName),
            },
          }, null, 2));
        } else {
          console.log(`[MusicSkills] Created project "${newChat.name}"`);
          console.log(`   ID:       ${newChat.id}`);
          console.log(`   Genre:    ${newChat.style.genre} | BPM: ${newChat.style.bpm} | Key: ${newChat.style.key}`);
          console.log(`   Location: .chats/${newChat.folderName}/`);
          console.log(`   Web Studio: Open Studio at http://localhost:3000 to see project live!`);
        }
        break;
      }

      case 'generate': {
        let projectId = args.id || args['project-id'] || args.p || args._[1];
        let chat = null;
        let dirPath = null;

        if (projectId) {
          const res = getChat(projectId);
          if (!res) {
            console.error(`Error: Project with ID "${projectId}" not found.`);
            process.exit(1);
          }
          chat = res.chat;
          dirPath = res.dirPath;
        } else {
          // Auto-create project if ID not supplied
          const title = args.name || args.title || args.topic || 'Autonomous Track';
          chat = createChat(title, {
            genre: args.genre || 'pop',
            bpm: args.bpm ? parseInt(args.bpm, 10) : 120,
            key: args.key || 'C',
          });
          projectId = chat.id;
          dirPath = path.join(getChatsDir(), chat.folderName);
        }

        const effectiveGenre = args.genre || chat.style.genre || 'pop';
        const effectiveBpm = args.bpm ? parseInt(args.bpm, 10) : chat.style.bpm || 120;
        const effectiveKey = args.key || chat.style.key || 'C';
        const effectiveMood = args.mood || (chat.style.moods && chat.style.moods[0]) || 'energetic';
        const effectivePurpose = args.purpose || (chat.style.purposes && chat.style.purposes[0]) || 'workout music';

        // Check if custom lyrics supplied via CLI
        let lyrics = chat.lyrics || {};
        if (args['lyrics-file']) {
          const content = fs.readFileSync(path.resolve(process.cwd(), args['lyrics-file']), 'utf-8');
          lyrics = content.startsWith('{') ? JSON.parse(content) : parseLyricsOutput(content);
          chat.lyrics = lyrics;
        } else if (args['lyrics-text']) {
          lyrics = parseLyricsOutput(args['lyrics-text']);
          chat.lyrics = lyrics;
        }

        const versionNum = chat.versions.length + 1;
        const versionLabel = `v${versionNum}`;
        const baseName = `${chat.folderName}_${versionLabel}`;

        if (!args.json) {
          console.log(`[MusicSkills] Composing arrangement for "${chat.name}" (${versionLabel})...`);
          console.log(`   Genre: ${effectiveGenre} | BPM: ${effectiveBpm} | Key: ${effectiveKey}`);
        }

        const render = await renderSong({
          chatDir: dirPath,
          topic: chat.name,
          genre: effectiveGenre,
          mood: effectiveMood,
          purpose: effectivePurpose,
          bpm: effectiveBpm,
          key: effectiveKey,
          lyrics,
          baseName,
          onProgress: (stage) => {
            if (!args.json) console.log(`   -> ${stage}`);
          },
        });

        const newVersion = {
          version: versionLabel,
          createdAt: new Date().toISOString(),
          bpm: effectiveBpm,
          key: effectiveKey,
          midiFile: render.midiFile,
          mp3File: render.mp3File,
          leadSheetFile: render.leadSheetFile,
          durationSec: render.durationSec,
          notes: args.notes || 'Rendered via External Agent CLI',
        };

        chat.versions.push(newVersion);
        chat.step = 'result';
        chat.updatedAt = new Date().toISOString();
        saveChat(chat);

        if (args.json) {
          console.log(JSON.stringify({
            success: true,
            projectId: chat.id,
            version: versionLabel,
            midiFile: path.join(dirPath, render.midiFile),
            mp3File: render.mp3File ? path.join(dirPath, render.mp3File) : null,
            leadSheetFile: path.join(dirPath, render.leadSheetFile),
            lrcFile: path.join(dirPath, `${baseName}.lrc`),
            durationSec: render.durationSec,
          }, null, 2));
        } else {
          console.log(`\n[SUCCESS] Music generation complete!`);
          console.log(`   - MIDI:       ${path.join(dirPath, render.midiFile)}`);
          if (render.mp3File) console.log(`   - Audio MP3:  ${path.join(dirPath, render.mp3File)}`);
          console.log(`   - Lead Sheet: ${path.join(dirPath, render.leadSheetFile)}`);
          console.log(`   - Synced LRC: ${path.join(dirPath, `${baseName}.lrc`)}`);
          console.log(`\n[Live Stream] Project updated in MusicSkills Studio at http://localhost:3000`);
        }
        break;
      }

      case 'add-lyrics':
      case 'lyrics': {
        const projectId = args.id || args['project-id'] || args.p || args._[1];
        if (!projectId) {
          console.error('Error: --id or --project-id is required.');
          process.exit(1);
        }

        const res = getChat(projectId);
        if (!res) {
          console.error(`Error: Project "${projectId}" not found.`);
          process.exit(1);
        }

        let lyricsText = args.text || args.t;
        if (args.file || args.f) {
          lyricsText = fs.readFileSync(path.resolve(process.cwd(), args.file || args.f), 'utf-8');
        }

        if (!lyricsText) {
          console.error('Error: Provide lyrics using --text "..." or --file <path>');
          process.exit(1);
        }

        const parsed = lyricsText.startsWith('{') ? JSON.parse(lyricsText) : parseLyricsOutput(lyricsText);
        res.chat.lyrics = parsed;
        res.chat.updatedAt = new Date().toISOString();
        saveChat(res.chat);

        if (args.json) {
          console.log(JSON.stringify({ success: true, projectId, sections: Object.keys(parsed) }, null, 2));
        } else {
          console.log(`[MusicSkills] Attached lyrics to project "${res.chat.name}".`);
          console.log(`   Sections loaded: ${Object.keys(parsed).join(', ')}`);
        }
        break;
      }

      case 'remotion':
      case 'video': {
        const projectId = args.id || args['project-id'] || args.p || args._[1];
        if (!projectId) {
          console.error('Error: --id or --project-id is required.');
          process.exit(1);
        }

        const res = getChat(projectId);
        if (!res) {
          console.error(`Error: Project "${projectId}" not found.`);
          process.exit(1);
        }

        const videoDir = path.join(res.dirPath, 'video');
        fs.mkdirSync(videoDir, { recursive: true });

        let code = args.code;
        if (args['code-file']) {
          code = fs.readFileSync(path.resolve(process.cwd(), args['code-file']), 'utf-8');
        } else if (!code) {
          const style = args.style || '3d-tunnel';
          code = `// Remotion + WebGL Audio-Reactive Lyrics Animation
// Project: ${res.chat.name} · Style: ${style}
import React from 'react';

export const MusicVideoComposition = ({ frame, fps, durationInFrames, audioData }) => {
  const isDrop = frame > 600 && frame < 1800;
  const currentLyric = audioData?.currentLyric || '${res.chat.name}';
  const pulseScale = isDrop ? 1.4 : 1.0;

  return {
    camera: { z: 450 - Math.sin(frame * 0.05) * 60, rotationY: (frame / fps) * 0.2 },
    bloom: { radius: isDrop ? 0.85 : 0.35 },
    subtitle: currentLyric,
    scale: pulseScale,
  };
};
`;
        }

        const compPath = path.join(videoDir, 'RemotionComposition.tsx');
        fs.writeFileSync(compPath, code, 'utf-8');

        res.chat.updatedAt = new Date().toISOString();
        saveChat(res.chat);

        if (args.json) {
          console.log(JSON.stringify({ success: true, projectId, remotionFile: compPath }, null, 2));
        } else {
          console.log(`[MusicSkills] Remotion animation registered for "${res.chat.name}"`);
          console.log(`   File: ${compPath}`);
          console.log(`   Preview: Open http://localhost:3000 to view live 3D Remotion preview!`);
        }
        break;
      }

      case 'cover':
      case 'remix': {
        const projectId = args.id || args['project-id'] || args.p || args._[1];
        if (!projectId) {
          console.error('Error: --id or --project-id is required.');
          process.exit(1);
        }

        const res = getChat(projectId);
        if (!res) {
          console.error(`Error: Project "${projectId}" not found.`);
          process.exit(1);
        }

        const { chat, dirPath } = res;
        const targetSection = args.section || 'chorus';
        const instruction = args.instruction || 'Cover variation';
        const effectiveGenre = args.genre || chat.style.genre;
        const effectiveBpm = args.bpm ? parseInt(args.bpm, 10) : chat.style.bpm;

        const versionNum = chat.versions.length + 1;
        const versionLabel = `v${versionNum} (Cover - ${targetSection})`;
        const baseName = `${chat.folderName}_cover_v${versionNum}`;

        const render = await renderSong({
          chatDir: dirPath,
          topic: `${chat.name} (Cover)`,
          genre: effectiveGenre,
          mood: (chat.style.moods && chat.style.moods[0]) || 'energetic',
          purpose: (chat.style.purposes && chat.style.purposes[0]) || 'workout music',
          bpm: effectiveBpm,
          key: chat.style.key || 'C',
          lyrics: chat.lyrics,
          baseName,
        });

        chat.versions.push({
          version: versionLabel,
          createdAt: new Date().toISOString(),
          bpm: effectiveBpm,
          key: chat.style.key,
          midiFile: render.midiFile,
          mp3File: render.mp3File,
          leadSheetFile: render.leadSheetFile,
          durationSec: render.durationSec,
          notes: `Cover variation: ${instruction}`,
        });

        chat.updatedAt = new Date().toISOString();
        saveChat(chat);

        if (args.json) {
          console.log(JSON.stringify({ success: true, projectId, version: versionLabel, midiFile: render.midiFile }, null, 2));
        } else {
          console.log(`[MusicSkills] Created cover variation for "${chat.name}" (${versionLabel})!`);
        }
        break;
      }

      case 'list': {
        const chats = listChats();
        if (args.json) {
          console.log(JSON.stringify(chats.map(c => ({
            id: c.id,
            name: c.name,
            genre: c.style.genre,
            bpm: c.style.bpm,
            key: c.style.key,
            versions: c.versions.length,
            updatedAt: c.updatedAt,
            folder: c.folderName,
          })), null, 2));
        } else {
          console.log(`\n=== MusicSkills Studio Projects (${chats.length}) ===\n`);
          if (chats.length === 0) {
            console.log('No projects found in .chats/. Use "musicskills new-project --name <name>" to create one.');
          } else {
            for (const c of chats) {
              console.log(`- [${c.id}] "${c.name}"`);
              console.log(`   Genre: ${c.style.genre} | BPM: ${c.style.bpm} | Key: ${c.style.key} | Versions: ${c.versions.length}`);
              console.log(`   Directory: .chats/${c.folderName}/\n`);
            }
          }
        }
        break;
      }

      case 'show': {
        const projectId = args.id || args['project-id'] || args.p || args._[1];
        if (!projectId) {
          console.error('Error: --id or --project-id is required.');
          process.exit(1);
        }

        const res = getChat(projectId);
        if (!res) {
          console.error(`Error: Project "${projectId}" not found.`);
          process.exit(1);
        }

        if (args.json) {
          console.log(JSON.stringify(res.chat, null, 2));
        } else {
          console.log(`\n=== Project Details: "${res.chat.name}" [${res.chat.id}] ===`);
          console.log(`Genre: ${res.chat.style.genre} | BPM: ${res.chat.style.bpm} | Key: ${res.chat.style.key}`);
          console.log(`Created: ${res.chat.createdAt} | Updated: ${res.chat.updatedAt}`);
          console.log(`Versions (${res.chat.versions.length}):`);
          for (const v of res.chat.versions) {
            console.log(`   - ${v.version} (${v.durationSec}s) -> ${v.midiFile} ${v.mp3File ? `| ${v.mp3File}` : ''}`);
          }
          console.log(`Lyrics Sections (${Object.keys(res.chat.lyrics).length}): ${Object.keys(res.chat.lyrics).join(', ')}`);
        }
        break;
      }

      case 'fetch-lyrics': {
        const projectId = args.id || args['project-id'] || args.p || args._[1];
        if (!projectId) {
          console.error('Error: --id or --project-id is required.');
          process.exit(1);
        }

        const res = getChat(projectId);
        if (!res) {
          console.error(`Error: Project "${projectId}" not found.`);
          process.exit(1);
        }

        const query = args.query || args.q || res.chat.name;
        if (!args.json) {
          console.log(`[MusicSkills] Fetching synchronized lyrics from LRCLIB for "${query}"...`);
        }

        const lyricsRef = await fetchLRCLibReference(query);
        if (!lyricsRef) {
          if (args.json) {
            console.log(JSON.stringify({ success: false, message: 'No lyrics found on LRCLIB' }));
          } else {
            console.log(`[LRCLIB] No lyrics found matching query: "${query}"`);
          }
          break;
        }

        // Save lyrics to project
        if (lyricsRef.syncedLyrics) {
          const lrcPath = path.join(res.dirPath, 'v1_custom.lrc');
          fs.writeFileSync(lrcPath, lyricsRef.syncedLyrics, 'utf-8');
        }

        const parsed = parseLyricsOutput(lyricsRef.lyricsText);
        res.chat.lyrics = parsed;
        res.chat.updatedAt = new Date().toISOString();
        saveChat(res.chat);

        if (args.json) {
          console.log(JSON.stringify({
            success: true,
            trackName: lyricsRef.trackName,
            artistName: lyricsRef.artistName,
            hasSynced: Boolean(lyricsRef.syncedLyrics),
            sections: Object.keys(parsed),
          }, null, 2));
        } else {
          console.log(`[SUCCESS] Cached lyrics from LRCLIB:`);
          console.log(`   Track:    "${lyricsRef.trackName}" by ${lyricsRef.artistName}`);
          console.log(`   Type:     ${lyricsRef.syncedLyrics ? 'Synchronized (.lrc)' : 'Plain text'}`);
          console.log(`   Sections: ${Object.keys(parsed).join(', ')}`);
        }
        break;
      }

      case 'status': {
        const config = loadConfig();
        const sfExists = fs.existsSync(config.soundfontPath);
        const chats = listChats();

        if (args.json) {
          console.log(JSON.stringify({
            status: 'ready',
            configFile: 'settings.json',
            projectsDirectory: getChatsDir(),
            projectsCount: chats.length,
            soundfontPath: config.soundfontPath,
            soundfontExists: sfExists,
            activeProvider: config.provider,
            activeModel: config.model,
            webStudioUrl: 'http://localhost:3000',
            cliAgentReady: true,
          }, null, 2));
        } else {
          console.log(`\n=== MusicSkills Studio & Agent Bridge Status ===`);
          console.log(`Config File:       settings.json (Primary)`);
          console.log(`Projects Directory: ${getChatsDir()} (${chats.length} projects)`);
          console.log(`SoundFont Path:    ${config.soundfontPath} [${sfExists ? 'DETECTED' : 'MISSING'}]`);
          console.log(`Active Provider:   ${config.provider} (${config.model})`);
          console.log(`Web Studio URL:    http://localhost:3000`);
          console.log(`CLI Agent Ready:   Yes (Claude Code, Codex, Antigravity)\n`);
        }
        break;
      }

      default:
        console.error(`Unknown command: "${command}". Run "musicskills --help" for available commands.`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`[Error] CLI command failed: ${err.message}`);
    process.exit(1);
  }
}

main();

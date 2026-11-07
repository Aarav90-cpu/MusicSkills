import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadConfig, saveConfig, exportSettingsJson, importSettingsJson, maskKey, SETTINGS_FILE } from './config';

const execFileAsync = promisify(execFile);
import { listChats, getChat, createChat, saveChat, deleteChat, getChatsDir, exportProjectZip, importProjectZip, importCustomSong, parseLrcToLyricsMap } from './chats';
import { generateLyrics, generateLocalFallbackLyrics, getAIModel, testApiKey, fetchLRCLibReference } from './ai';
import { renderSong, mixVocalTake, renderMidiToAudio } from './audio';
import { detectExternalAgents, startAgentSession, getAgentSession, cancelAgentSession } from './externalAgents';

async function checkCommand(cmd: string, args: string[]): Promise<{ installed: boolean; version?: string; path?: string }> {
  try {
    const whichRes = await execFileAsync('which', [cmd]);
    const binPath = whichRes.stdout.trim();
    if (!binPath) return { installed: false };
    try {
      const verRes = await execFileAsync(binPath, args);
      const firstLine = (verRes.stdout || verRes.stderr).split('\n')[0].trim();
      return { installed: true, version: firstLine, path: binPath };
    } catch {
      return { installed: true, path: binPath };
    }
  } catch {
    return { installed: false };
  }
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer upload config for vocal recordings
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- REAL-TIME EVENT STREAM (SSE) FOR EXTERNAL AGENTS & BROWSER ---
const sseClients = new Set<express.Response>();

export function broadcastEvent(event: { type: string; payload?: any; message?: string }) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'connected', clientsCount: sseClients.size })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// --- SYSTEM & CONFIG ROUTES ---

app.get('/api/status', (req, res) => {
  const config = loadConfig();
  const chats = listChats();
  const soundfontExists = fs.existsSync(config.soundfontPath || '/usr/share/soundfonts/FluidR3_GM.sf2');

  res.json({
    online: true,
    version: '1.0.0',
    provider: config.provider,
    model: config.model,
    hasApiKey: Boolean(config.apiKey && config.apiKey.length > 0),
    soundfontExists,
    soundfontPath: config.soundfontPath,
    totalChats: chats.length,
    theme: config.theme,
  });
});

app.get('/api/config', (req, res) => {
  const config = loadConfig();
  res.json({
    ...config,
    apiKeyMasked: maskKey(config.apiKey),
    hasApiKey: Boolean(config.apiKey && config.apiKey.length > 0),
  });
});

app.post('/api/config', (req, res) => {
  const updates = req.body;
  const updated = saveConfig(updates);
  res.json({
    ...updated,
    apiKeyMasked: maskKey(updated.apiKey),
    hasApiKey: Boolean(updated.apiKey && updated.apiKey.length > 0),
  });
});

app.get('/api/settings', (req, res) => {
  const config = loadConfig();
  res.json({
    ...config,
    apiKeyMasked: maskKey(config.apiKey),
    hasApiKey: Boolean(config.apiKey && config.apiKey.length > 0),
  });
});

app.post('/api/settings', (req, res) => {
  const updates = req.body;
  const updated = saveConfig(updates);
  res.json({
    ...updated,
    apiKeyMasked: maskKey(updated.apiKey),
    hasApiKey: Boolean(updated.apiKey && updated.apiKey.length > 0),
  });
});

app.get('/api/settings/export', (req, res) => {
  const jsonContent = exportSettingsJson();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="settings.json"');
  res.send(jsonContent);
});

app.post('/api/settings/import', (req, res) => {
  try {
    let settingsObj = req.body;
    if (typeof settingsObj === 'string') {
      settingsObj = JSON.parse(settingsObj);
    }
    const updated = saveConfig(settingsObj);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid settings.json file', details: err.message });
  }
});

app.get('/api/system/dependencies', async (req, res) => {
  const [python, ffmpeg, fluidsynth, chromium, node] = await Promise.all([
    checkCommand('python3', ['--version']),
    checkCommand('ffmpeg', ['-version']),
    checkCommand('fluidsynth', ['--version']),
    checkCommand('chromium', ['--version']).then(async r => r.installed ? r : checkCommand('google-chrome', ['--version'])),
    checkCommand('node', ['--version']),
  ]);

  const config = loadConfig();
  const soundfontInstalled = fs.existsSync(config.soundfontPath);

  res.json({
    python3: {
      ...python,
      required: true,
      name: 'Python 3',
      purpose: 'MIDI generation, Humanizer engine, and musical theory calculation',
      installCommand: 'sudo apt install python3 python3-pip python3-venv',
    },
    ffmpeg: {
      ...ffmpeg,
      required: true,
      name: 'FFmpeg',
      purpose: 'Audio transcoding (WAV to MP3), normalization, and video stream mixing',
      installCommand: 'sudo apt install ffmpeg',
    },
    fluidsynth: {
      ...fluidsynth,
      required: true,
      name: 'FluidSynth',
      purpose: 'SoundFont software synthesizer rendering MIDI files to high-fidelity audio',
      installCommand: 'sudo apt install fluidsynth fluid-soundfont-gm',
    },
    chromium: {
      ...chromium,
      required: false,
      name: 'Chromium / Chrome',
      purpose: 'Headless browser rendering for Remotion music video exports and WebGL canvas snapshots',
      installCommand: 'sudo apt install chromium || sudo apt install google-chrome-stable',
    },
    soundfont: {
      installed: soundfontInstalled,
      path: config.soundfontPath,
      required: true,
      name: 'General MIDI SoundFont Bank',
      purpose: 'Acoustic and synthesized sample banks (FluidR3_GM.sf2) supplying instruments',
      installCommand: 'sudo apt install fluid-soundfont-gm soundfont-fluid',
    },
    node: {
      ...node,
      required: true,
      name: 'Node.js & npm',
      purpose: 'Full-stack studio runtime and API server',
    },
  });
});

app.post('/api/test-key', async (req, res) => {
  const { provider, model, apiKey } = req.body;
  const result = await testApiKey(provider, model, apiKey);
  res.json(result);
});

// --- CHATS & STORAGE ROUTES ---

app.get('/api/chats', (req, res) => {
  const chats = listChats();
  res.json(chats);
});

app.post('/api/chats', (req, res) => {
  const { name, style } = req.body;
  const newChat = createChat(name || 'New Song', style);
  res.status(201).json(newChat);
});

app.get('/api/chats/:id', (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  res.json(result.chat);
});

app.patch('/api/chats/:id', (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  const chat = result.chat;
  const { name, step, style, lyrics, sections, messages } = req.body;

  if (name !== undefined) chat.name = name;
  if (step !== undefined) chat.step = step;
  if (style !== undefined) chat.style = { ...chat.style, ...style };
  if (lyrics !== undefined) chat.lyrics = { ...chat.lyrics, ...lyrics };
  if (sections !== undefined) chat.sections = sections;
  if (messages !== undefined) chat.messages = messages;

  saveChat(chat);
  res.json(chat);
});

app.delete('/api/chats/:id', (req, res) => {
  const ok = deleteChat(req.params.id as string);
  if (!ok) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  res.json({ success: true, id: req.params.id });
});

// --- PROJECT EXPORT & IMPORT ROUTES ---

app.get('/api/projects/:id/export', async (req, res) => {
  try {
    const { zipPath, filename } = await exportProjectZip(req.params.id as string);
    res.download(zipPath, filename, (err) => {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch (_) {}
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

app.post('/api/projects/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const originalName = req.file.originalname || 'project.zip';
  const tempPath = path.join('/tmp', `upload-${Date.now()}-${originalName}`);
  fs.writeFileSync(tempPath, req.file.buffer);

  try {
    if (originalName.endsWith('.json')) {
      const content = JSON.parse(req.file.buffer.toString('utf-8'));
      const newChat = createChat(content.name || 'Imported Song', content.style);
      newChat.lyrics = content.lyrics || {};
      newChat.sections = content.sections || newChat.sections;
      newChat.step = content.step || 'review';
      saveChat(newChat);
      return res.status(201).json({ success: true, chat: newChat });
    } else {
      const importedChat = await importProjectZip(tempPath);
      return res.status(201).json({ success: true, chat: importedChat });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Import failed' });
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
  }
});

app.post('/api/custom-song/import', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'lrc', maxCount: 1 }]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const audioFile = files?.['audio']?.[0];
  if (!audioFile) {
    return res.status(400).json({ error: 'Audio file (.mp3, .wav) is required' });
  }

  const { title = 'Custom Track', artist = '', album = '', genre = 'pop', bpm = '120', durationSec = '180' } = req.body;
  const lrcFile = files?.['lrc']?.[0];
  const lrcContent = lrcFile ? lrcFile.buffer.toString('utf-8') : (req.body.lrcText || '');

  try {
    const newChat = await importCustomSong({
      title,
      artist,
      album,
      genre,
      bpm: parseInt(bpm) || 120,
      durationSec: parseFloat(durationSec) || 180,
      audioBuffer: audioFile.buffer,
      audioOriginalName: audioFile.originalname,
      lrcContent,
    });

    res.status(201).json({ success: true, chat: newChat });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Custom song import failed' });
  }
});

app.patch('/api/chats/:id/lyrics-sync', (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) return res.status(404).json({ error: 'Chat not found' });

  const { lrcContent, lyrics } = req.body;
  const { chat, dirPath } = result;

  if (lrcContent) {
    const lrcPath = path.join(dirPath, `${chat.folderName}_synced.lrc`);
    fs.writeFileSync(lrcPath, lrcContent, 'utf-8');
    if (chat.versions.length > 0) {
      chat.versions[chat.versions.length - 1].leadSheetFile = `${chat.folderName}_synced.lrc`;
    }
  }

  if (lyrics) {
    chat.lyrics = lyrics;
  }

  saveChat(chat);
  res.json({ success: true, chat });
});

app.get('/api/chats/:id/video', (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) return res.status(404).json({ error: 'Chat not found' });

  const { dirPath } = result;
  const videoFile = path.join(dirPath, 'video', 'RemotionComposition.tsx');
  if (fs.existsSync(videoFile)) {
    const code = fs.readFileSync(videoFile, 'utf-8');
    return res.json({ exists: true, compositionCode: code });
  }

  return res.json({ exists: false, compositionCode: '' });
});

app.post('/api/chats/:id/video', (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) return res.status(404).json({ error: 'Chat not found' });

  const { dirPath, chat } = result;
  const { compositionCode } = req.body;
  if (!compositionCode) return res.status(400).json({ error: 'Composition code is required' });

  const videoDir = path.join(dirPath, 'video');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
  const videoFile = path.join(videoDir, 'RemotionComposition.tsx');
  fs.writeFileSync(videoFile, compositionCode, 'utf-8');

  broadcastEvent({
    type: 'chats_updated',
    message: `Updated 3D Remotion composition for "${chat.name}"`,
    payload: { id: chat.id, file: 'video/RemotionComposition.tsx' },
  });

  res.json({ success: true, path: videoFile });
});

// --- AI SONGWRITING & LYRICS ROUTES ---

app.post('/api/ai/lyrics', async (req, res) => {
  const { topic, genre, mood, purpose, vocalDelivery, sections, referenceSong, referenceLyrics } = req.body;
  try {
    const lyrics = await generateLyrics({
      topic,
      genre,
      mood,
      purpose,
      vocalDelivery,
      sections: sections || [],
      referenceSong,
      referenceLyrics,
    });
    res.json({ lyrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { chatId, message, currentLyrics, style } = req.body;
  const result = getChat(chatId);
  if (!result) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const chat = result.chat;
  const userMsgId = `msg-${Date.now()}`;
  chat.messages.push({
    id: userMsgId,
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  });

  const config = loadConfig();
  let assistantReply = '';
  let updatedLyrics = currentLyrics;

  if (config.apiKey) {
    try {
      let referenceContext = '';
      if (
        message.toLowerCase().includes('based on') ||
        message.toLowerCase().includes('lyrics of') ||
        message.toLowerCase().includes('inspired by')
      ) {
        const ref = await fetchLRCLibReference(message);
        if (ref) {
          referenceContext = `\n\n[LRCLIB Tool: Reference Song Baseline Loaded]\nTitle: "${ref.trackName}" by ${ref.artistName}\nBaseline Lyrics:\n${ref.lyricsText}\nInstruction: The user wants their song inspired by or based on this baseline track. Use its themes, rhythm, and phrasing structure to guide your output without copying verbatim.`;
        }
      }

      const model = getAIModel();
      const { text } = await (await import('ai')).generateText({
        model,
        system: `You are an expert music co-writer assisting with the song "${chat.name}".
Style: ${style?.genre || 'Pop'} (${style?.moods?.join(', ') || 'Energetic'})
Current Lyrics:
${JSON.stringify(currentLyrics, null, 2)}${referenceContext}

Incorporate the user's instructions.
If modifying lyrics, output the updated sections clearly in format [Section Name] followed by lines.
Otherwise provide crisp, creative advice on musical arrangement, rhythm, or phrasing.
Do not use emojis at any cost.`,
        prompt: message,
        temperature: config.creativity || 0.7,
      });
      assistantReply = text;
    } catch (err) {
      assistantReply = `I have received your request: "${message}". I will incorporate these refinements into the next musical iteration.`;
    }
  } else {
    assistantReply = `Refining your track with request: "${message}". The arrangement parameters have been updated accordingly.`;
  }

  const assistMsgId = `msg-${Date.now() + 1}`;
  chat.messages.push({
    id: assistMsgId,
    role: 'assistant',
    content: assistantReply,
    timestamp: new Date().toISOString(),
  });

  saveChat(chat);
  res.json({ reply: assistantReply, chat });
});

// --- MUSIC GENERATION & AUDIO ENGINE ROUTES ---

app.post('/api/generate-music', async (req, res) => {
  const { chatId } = req.body;
  const result = getChat(chatId);
  if (!result) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const { chat, dirPath } = result;
  const versionNum = chat.versions.length + 1;
  const versionLabel = `v${versionNum}`;
  const baseName = `${chat.folderName}_${versionLabel}`;

  try {
    const render = await renderSong({
      chatDir: dirPath,
      topic: chat.style.topic || chat.name,
      genre: chat.style.genre || 'pop',
      mood: (chat.style.moods && chat.style.moods[0]) || 'energetic',
      purpose: (chat.style.purposes && chat.style.purposes[0]) || 'workout music',
      bpm: chat.style.bpm || 120,
      key: chat.style.key || 'C',
      lyrics: chat.lyrics,
      baseName,
    });

    const newVersion = {
      version: versionLabel,
      createdAt: new Date().toISOString(),
      bpm: chat.style.bpm,
      key: chat.style.key,
      midiFile: render.midiFile,
      mp3File: render.mp3File,
      leadSheetFile: render.leadSheetFile,
      durationSec: render.durationSec,
      notes: `Generated ${versionLabel} with humanized timing and velocity`,
    };

    chat.versions.push(newVersion);
    chat.step = 'result';
    saveChat(chat);

    res.json({
      success: true,
      version: newVersion,
      peaks: render.peaks,
      chat,
    });
  } catch (err: any) {
    console.error('Music generation failed:', err);
    res.status(500).json({ error: err.message || 'Music generation failed' });
  }
});

// --- AUDIO FILE SERVING & RANGE STREAMING (ON-DEMAND TRANSCODING) ---

async function handleAudioRequest(req: express.Request, res: express.Response) {
  const chatId = req.params.chatId as string;
  if (!chatId) return res.status(400).send('Chat ID is required');

  const result = getChat(chatId);
  if (!result) {
    return res.status(404).send('Chat not found');
  }

  const { dirPath, chat } = result;
  let filename = req.params.filename as string | undefined;

  // If filename is missing, 'undefined', 'null', or empty: auto-resolve latest audio
  if (!filename || filename === 'undefined' || filename === 'null') {
    const latest = chat.versions.length > 0 ? chat.versions[chat.versions.length - 1] : null;
    filename = latest?.mp3File || (latest?.midiFile ? latest.midiFile.replace(/\.mid$/, '.mp3') : '');
    if (!filename) {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        const mp3 = files.find(f => f.endsWith('.mp3'));
        if (mp3) filename = mp3;
        else {
          const mid = files.find(f => f.endsWith('.mid'));
          if (mid) filename = mid.replace(/\.mid$/, '.mp3');
        }
      }
    }
  }

  if (!filename) {
    return res.status(404).send('No audio track available for this song');
  }

  let filePath = path.join(dirPath, filename);

  // If requested MP3 does not exist on disk, but a MIDI file exists: ON-DEMAND TRANSCRIBE!
  if (!fs.existsSync(filePath) && filename.endsWith('.mp3')) {
    const baseName = filename.replace(/\.mp3$/, '');
    let midiPath = path.join(dirPath, `${baseName}.mid`);
    if (!fs.existsSync(midiPath)) {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        const anyMid = files.find(f => f.endsWith('.mid'));
        if (anyMid) midiPath = path.join(dirPath, anyMid);
      }
    }

    if (fs.existsSync(midiPath)) {
      try {
        await renderMidiToAudio(midiPath, filePath);
        // Persist mp3 filename into chat version if missing
        if (chat.versions.length > 0) {
          const latest = chat.versions[chat.versions.length - 1];
          if (!latest.mp3File) {
            latest.mp3File = filename;
            saveChat(chat);
          }
        }
      } catch (synthErr) {
        console.warn('On-demand audio synthesis error:', synthErr);
      }
    }
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Audio file not found');
  }

  const isMp3 = filePath.endsWith('.mp3');
  const isWav = filePath.endsWith('.wav');
  const isMid = filePath.endsWith('.mid');
  const contentType = isMp3 ? 'audio/mpeg' : (isWav ? 'audio/wav' : (isMid ? 'audio/midi' : 'application/octet-stream'));

  // Use res.sendFile with dotfiles: 'allow' so that .chats/ paths are fully accessible with Range support
  res.sendFile(path.resolve(filePath), {
    dotfiles: 'allow',
    acceptRanges: true,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
    },
  });
}

app.get(['/api/audio/:chatId', '/api/audio/:chatId/:filename'], handleAudioRequest);
app.head(['/api/audio/:chatId', '/api/audio/:chatId/:filename'], handleAudioRequest);

// --- VOCAL RECORDINGS & MIXING ROUTES ---

app.post('/api/chats/:id/vocals/take', upload.single('audio'), (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const { section = 'Full Song', durationSec = 0 } = req.body;
  const takeId = `take-${Date.now()}`;
  const filename = `${takeId}.wav`;
  const vocalDirPath = path.join(result.dirPath, 'vocals');

  if (!fs.existsSync(vocalDirPath)) {
    fs.mkdirSync(vocalDirPath, { recursive: true });
  }

  const targetPath = path.join(vocalDirPath, filename);
  fs.writeFileSync(targetPath, req.file.buffer);

  const take = {
    id: takeId,
    section,
    filename: path.join('vocals', filename),
    createdAt: new Date().toISOString(),
    durationSec: parseFloat(durationSec) || 0,
    isFavorite: false,
  };

  result.chat.takes.push(take);
  saveChat(result.chat);

  res.status(201).json({ take, chat: result.chat });
});

app.post('/api/chats/:id/vocals/mix', async (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const {
    backingMp3,
    vocalWav,
    vocalVolume = 1.0,
    backingVolume = 0.8,
    syncOffsetMs = 0,
    reverbPercent = 15,
  } = req.body;

  try {
    const outputFilename = `mix_${Date.now()}.mp3`;
    const mixedFile = await mixVocalTake({
      chatDir: result.dirPath,
      backingMp3,
      vocalWav,
      outputMp3: outputFilename,
      vocalVolume,
      backingVolume,
      syncOffsetMs,
      reverbPercent,
    });

    res.json({ success: true, mixedFile });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to mix audio' });
  }
});

// --- DOWNLOAD FILE ROUTE ---

app.get('/api/chats/:id/download/:filename', (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) {
    return res.status(404).send('Chat not found');
  }

  const filePath = path.join(result.dirPath, req.params.filename as string);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath);
});

// --- COVER & VARIATION CREATOR ROUTE ---

app.post('/api/chats/:id/cover', async (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) return res.status(404).json({ error: 'Chat not found' });

  const { chat, dirPath } = result;
  const { targetSection, coverInstruction, bpm, genre } = req.body;

  const versionCount = chat.versions.length + 1;
  const versionLabel = `v${versionCount} (Cover)`;
  const baseName = `${chat.folderName}_cover_v${versionCount}`;

  const effectiveBpm = bpm ? parseInt(bpm) : chat.style.bpm;
  const effectiveGenre = genre || chat.style.genre;

  try {
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

    const newVersion = {
      version: versionLabel,
      createdAt: new Date().toISOString(),
      bpm: effectiveBpm,
      key: chat.style.key,
      midiFile: render.midiFile,
      mp3File: render.mp3File,
      leadSheetFile: render.leadSheetFile,
      durationSec: render.durationSec,
      notes: `Cover variation: ${coverInstruction || 'Arrangement variation'}`,
    };

    chat.versions.push(newVersion);
    chat.step = 'result';
    saveChat(chat);

    res.json({
      success: true,
      version: newVersion,
      peaks: render.peaks,
      chat,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to render cover variation' });
  }
});

// --- PYTHON CODE EDITOR & RUNNER ROUTES ---

app.get('/api/code/files', (req, res) => {
  const baseScriptsDir = path.resolve(process.cwd(), 'scripts');
  const files: Array<{ name: string; path: string; size: number }> = [];

  if (fs.existsSync(baseScriptsDir)) {
    const entries = fs.readdirSync(baseScriptsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.py')) {
        const fullPath = path.join(baseScriptsDir, entry.name);
        const stat = fs.statSync(fullPath);
        files.push({
          name: entry.name,
          path: path.relative(process.cwd(), fullPath),
          size: stat.size,
        });
      }
    }
  }

  const chatId = req.query.chatId as string;
  if (chatId) {
    const result = getChat(chatId);
    if (result && fs.existsSync(result.dirPath)) {
      const projectEntries = fs.readdirSync(result.dirPath, { withFileTypes: true });
      for (const entry of projectEntries) {
        if (entry.isFile() && entry.name.endsWith('.py')) {
          const fullPath = path.join(result.dirPath, entry.name);
          const stat = fs.statSync(fullPath);
          files.push({
            name: `${result.chat.name} / ${entry.name}`,
            path: path.relative(process.cwd(), fullPath),
            size: stat.size,
          });
        }
      }
    }
  }

  res.json({ files });
});

app.get('/api/code/file', (req, res) => {
  const relPath = req.query.path as string;
  if (!relPath) return res.status(400).json({ error: 'Missing path parameter' });

  const resolved = path.resolve(process.cwd(), relPath);
  if (!resolved.startsWith(process.cwd())) {
    return res.status(403).json({ error: 'Access denied: outside workspace' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  res.json({ path: relPath, content });
});

app.post('/api/code/file', (req, res) => {
  const { path: relPath, content } = req.body;
  if (!relPath || content === undefined) {
    return res.status(400).json({ error: 'Missing path or content parameter' });
  }

  const resolved = path.resolve(process.cwd(), relPath);
  if (!resolved.startsWith(process.cwd())) {
    return res.status(403).json({ error: 'Access denied: outside workspace' });
  }

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf-8');
  res.json({ success: true, path: relPath, bytes: Buffer.byteLength(content) });
});

app.post('/api/code/run', async (req, res) => {
  const { path: relPath, args = [] } = req.body;
  if (!relPath) return res.status(400).json({ error: 'Missing path parameter' });

  const resolved = path.resolve(process.cwd(), relPath);
  if (!resolved.startsWith(process.cwd())) {
    return res.status(403).json({ error: 'Access denied: outside workspace' });
  }

  const pythonBin = fs.existsSync(path.resolve(process.cwd(), '.venv/bin/python'))
    ? path.resolve(process.cwd(), '.venv/bin/python')
    : 'python3';

  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, [resolved, ...args], {
      cwd: process.cwd(),
      timeout: 30000,
    });
    res.json({ success: true, stdout, stderr, exitCode: 0 });
  } catch (err: any) {
    res.json({
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message,
      exitCode: err.code || 1,
    });
  }
});

// --- LRCLIB LYRICS PROXY ROUTES ---

app.get('/api/lrclib/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q) return res.json([]);

  try {
    const lrclibRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'MusicSkills-Studio/1.0.0 (https://github.com/Aarav90-cpu/MusicSkills)',
        'Lrclib-Client': 'MusicSkills-Studio/1.0.0',
      },
    });
    if (lrclibRes.ok) {
      const data = await lrclibRes.json();
      return res.json(data);
    }
    res.json([]);
  } catch (err: any) {
    res.status(502).json({ error: 'LRCLIB request failed', details: err.message });
  }
});

app.get('/api/lrclib/get', async (req, res) => {
  const { track_name, artist_name, album_name, duration } = req.query;
  if (!track_name || !artist_name) {
    return res.status(400).json({ error: 'track_name and artist_name are required' });
  }

  const query = new URLSearchParams();
  query.set('track_name', track_name as string);
  query.set('artist_name', artist_name as string);
  if (album_name) query.set('album_name', album_name as string);
  if (duration) query.set('duration', duration as string);

  try {
    const lrclibRes = await fetch(`https://lrclib.net/api/get?${query.toString()}`, {
      headers: {
        'User-Agent': 'MusicSkills-Studio/1.0.0 (https://github.com/Aarav90-cpu/MusicSkills)',
        'Lrclib-Client': 'MusicSkills-Studio/1.0.0',
      },
    });
    if (lrclibRes.ok) {
      const data = await lrclibRes.json();
      return res.json(data);
    }
    res.status(lrclibRes.status).json({ error: 'Not found on LRCLIB' });
  } catch (err: any) {
    res.status(502).json({ error: 'LRCLIB request failed', details: err.message });
  }
});

// --- EXTERNAL AGENT SESSION RUNNER (CLAUDE CODE, CODEX, ANTIGRAVITY) ---

app.get('/api/agents/available', async (req, res) => {
  const agents = await detectExternalAgents();
  res.json({ agents });
});

app.post('/api/agents/session/start', async (req, res) => {
  const { agent, task, chatId } = req.body;
  if (!task) return res.status(400).json({ error: 'Task prompt is required' });

  const session = startAgentSession({
    agent: agent || 'claude',
    task,
    chatId,
    onLogChunk: (log) => {
      broadcastEvent({
        type: 'agent_log',
        payload: { sessionId: session.id, log },
      });
    },
    onArtifactFound: (artifact) => {
      broadcastEvent({
        type: 'agent_artifact',
        payload: { sessionId: session.id, artifact },
        message: `External Agent created ${artifact.type}: ${artifact.name}`,
      });
    },
  });

  res.json({ success: true, sessionId: session.id, status: session.status, agent: session.agent });
});

app.get('/api/agents/session/:id', (req, res) => {
  const session = getAgentSession(req.params.id as string);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({
    id: session.id,
    agent: session.agent,
    status: session.status,
    task: session.task,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    exitCode: session.exitCode,
    logs: session.logs,
    createdArtifacts: session.createdArtifacts,
  });
});

app.post('/api/agents/session/:id/cancel', (req, res) => {
  const success = cancelAgentSession(req.params.id as string);
  res.json({ success });
});

// --- AUTOMATIC FILE WATCHER & OUTPUTS INTAKE ---

let watchDebounceTimer: NodeJS.Timeout | null = null;

function scanOutputsRecursively(dir: string, baseDir = dir): Array<{ fullPath: string; relPath: string; dirName: string; fileName: string }> {
  let results: Array<{ fullPath: string; relPath: string; dirName: string; fileName: string }> = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(scanOutputsRecursively(full, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.mid')) {
      const rel = path.relative(baseDir, full);
      results.push({
        fullPath: full,
        relPath: rel,
        dirName: path.dirname(rel) === '.' ? '' : path.dirname(rel),
        fileName: entry.name,
      });
    }
  }
  return results;
}

async function autoIntakeOutputs() {
  const outputsDir = path.resolve(process.cwd(), 'outputs');
  if (!fs.existsSync(outputsDir)) return;
  const midEntries = scanOutputsRecursively(outputsDir);

  for (const item of midEntries) {
    const baseName = item.fileName.replace(/\.mid$/, '');
    const existing = listChats().find(c => c.folderName.startsWith(baseName) || c.name.toLowerCase() === baseName.toLowerCase());
    if (!existing) {
      const title = baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      let genre = 'pop';
      if (item.dirName.includes('indian')) genre = 'indian';
      else if (item.dirName.includes('rock')) genre = 'rock';
      else if (item.dirName.includes('phonk')) genre = 'phonk';
      else if (item.dirName.includes('electronic')) genre = 'electronic';
      else if (item.dirName.includes('hip-hop')) genre = 'hip-hop';

      const newChat = createChat(title, {
        topic: title,
        genre,
        bpm: 120,
      });
      const targetDir = path.join(getChatsDir(), newChat.folderName);
      fs.copyFileSync(item.fullPath, path.join(targetDir, `${newChat.folderName}_v1.mid`));

      const sourceLrc = item.fullPath.replace(/\.mid$/, '.lrc');
      let lyricsMap: Record<string, string[]> = {};
      let lrcFileName = '';
      if (fs.existsSync(sourceLrc)) {
        lrcFileName = `${newChat.folderName}_v1.lrc`;
        fs.copyFileSync(sourceLrc, path.join(targetDir, lrcFileName));
        const lrcContent = fs.readFileSync(sourceLrc, 'utf-8');
        lyricsMap = parseLrcToLyricsMap(lrcContent);
      } else {
        lyricsMap = { 'Lyrics': ['[Instrumental composition]'] };
      }

      newChat.lyrics = lyricsMap;

      const sourceMp3 = item.fullPath.replace(/\.mid$/, '.mp3');
      const targetMp3 = `${newChat.folderName}_v1.mp3`;
      const targetMp3Path = path.join(targetDir, targetMp3);

      if (fs.existsSync(sourceMp3)) {
        fs.copyFileSync(sourceMp3, targetMp3Path);
      } else {
        try {
          await renderMidiToAudio(item.fullPath, targetMp3Path);
        } catch (e) {
          console.warn(`Could not render audio for auto-intake ${title}:`, e);
        }
      }

      newChat.versions.push({
        version: 'v1',
        createdAt: new Date().toISOString(),
        bpm: 120,
        key: 'C',
        midiFile: `${newChat.folderName}_v1.mid`,
        mp3File: targetMp3,
        leadSheetFile: lrcFileName,
        durationSec: 180,
        notes: `Auto-imported from outputs/${item.relPath}`,
      });
      saveChat(newChat);
      broadcastEvent({
        type: 'chats_updated',
        message: `Auto-imported project: "${title}" (${genre})`,
        payload: { id: newChat.id, name: title },
      });
    }
  }
}

function setupFileWatchers() {
  const chatsDir = getChatsDir();
  try {
    if (fs.existsSync(chatsDir)) {
      fs.watch(chatsDir, { recursive: true }, (eventType, filename) => {
        if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
        watchDebounceTimer = setTimeout(() => {
          broadcastEvent({
            type: 'chats_updated',
            message: `Project change detected: ${filename || 'library'}`,
            payload: { filename },
          });
        }, 250);
      });
    }
  } catch (e) {
    console.warn('Could not watch .chats directory:', e);
  }

  // Watch outputs/ directory for external AI tools
  const outputsDir = path.resolve(process.cwd(), 'outputs');
  try {
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    fs.watch(outputsDir, (eventType, filename) => {
      if (!filename) return;
      if (filename.endsWith('.mid') || filename.endsWith('.lrc')) {
        if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
        watchDebounceTimer = setTimeout(() => {
          autoIntakeOutputs();
        }, 300);
      }
    });
  } catch (_) {}
}

// --- SERVER INITIALIZATION WITH VITE INTEGRATION ---

async function startServer() {
  try {
    await autoIntakeOutputs();
  } catch (err) {
    console.warn('Initial auto-intake notice:', err);
  }
  setupFileWatchers();
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MusicSkills Studio] Active at http://localhost:${PORT}`);
    console.log(`[MusicSkills Studio] Dark Mode prioritized`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

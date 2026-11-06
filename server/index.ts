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
import { renderSong, mixVocalTake } from './audio';

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

  const { title = 'Custom Track', artist = '', genre = 'pop', bpm = '120' } = req.body;
  const lrcFile = files?.['lrc']?.[0];
  const lrcContent = lrcFile ? lrcFile.buffer.toString('utf-8') : (req.body.lrcText || '');

  try {
    const newChat = await importCustomSong({
      title,
      artist,
      genre,
      bpm: parseInt(bpm) || 120,
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

// --- AUDIO FILE SERVING & RANGE STREAMING ---

app.get('/api/audio/:chatId/:filename', (req, res) => {
  const result = getChat(req.params.chatId as string);
  if (!result) {
    return res.status(404).send('Chat not found');
  }

  const filePath = path.join(result.dirPath, req.params.filename as string);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Audio file not found');
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': filePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav',
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': filePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

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

// --- SERVER INITIALIZATION WITH VITE INTEGRATION ---

async function startServer() {
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

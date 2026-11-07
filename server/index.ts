import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadConfig, saveConfig, exportSettingsJson, importSettingsJson, maskKey, SETTINGS_FILE } from './config';

const execFileAsync = promisify(execFile);
import { listChats, getChat, createChat, saveChat, deleteChat, getChatsDir, exportProjectZip, importProjectZip, importCustomSong, parseLrcToLyricsMap, backfillChatsMetadata, extractEmbeddedId3, sanitizeName, ChatSession } from './chats';
import { generateLyrics, generateLocalFallbackLyrics, getAIModel, testApiKey, fetchLRCLibReference, generatePythonMusicCode, editPythonMusicCode } from './ai';
import { renderSong, mixVocalTake, renderMidiToAudio, extractWaveformPeaks } from './audio';
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

app.get('/api/chats', async (req, res) => {
  let chats = listChats();
  if (chats.length === 0) {
    try {
      await autoIntakeOutputs();
      chats = listChats();
    } catch (_) {}
  }
  // Backfill embedded cover art and lyrics from MP3 files
  try {
    backfillChatsMetadata();
    chats = listChats();
  } catch (_) {}
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
  const id = req.params.id as string;
  const ok = deleteChat(id);
  if (!ok) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  broadcastEvent({
    type: 'chats_updated',
    message: `Project deleted: ${id}`,
    payload: { id },
  });
  res.json({ success: true, id });
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

app.post('/api/custom-song/import', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'lrc', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const audioFile = files?.['audio']?.[0];
  if (!audioFile) {
    return res.status(400).json({ error: 'Audio file (.mp3, .wav) is required' });
  }

  const { title = 'Custom Track', artist = '', album = '', genre = 'pop', bpm = '120', durationSec = '180' } = req.body;
  const lrcFile = files?.['lrc']?.[0];
  const coverFile = files?.['cover']?.[0];
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
      coverBuffer: coverFile ? coverFile.buffer : undefined,
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
    const parsed = parseLrcToLyricsMap(lrcContent);
    if (Object.keys(parsed).length > 0) {
      chat.lyrics = parsed;
    }
  }

  if (lyrics) {
    chat.lyrics = lyrics;
  }

  saveChat(chat);
  broadcastEvent({
    type: 'chats_updated',
    message: `Synchronized lyrics saved for "${chat.name}"`,
    payload: { id: chat.id, leadSheetFile: `${chat.folderName}_synced.lrc` },
  });
  res.json({ success: true, chat });
});

const handleChatMetadataUpdate = async (req: express.Request, res: express.Response) => {
  const chatId = req.params.id as string;
  let resolved = await resolveChatDirectory(chatId);
  if (!resolved) {
    return res.json({ success: true, localOnly: true });
  }

  const { chat, dirPath } = resolved;
  const {
    title,
    artist,
    album,
    genre,
    bpm,
    rootKey,
    mood,
    purpose,
    composer,
    producer,
    notes,
    coverArtUrl,
    lyrics,
    lrcContent,
  } = req.body;

  if (title) chat.name = title.trim();
  if (genre || bpm || rootKey || mood || purpose) {
    chat.style = {
      ...(chat.style || {}),
      genre: genre || chat.style?.genre || 'pop',
      bpm: bpm ? parseInt(bpm, 10) : chat.style?.bpm || 120,
      key: rootKey || chat.style?.key || 'C',
      moods: mood ? [mood] : chat.style?.moods || [],
      purposes: purpose ? [purpose] : chat.style?.purposes || [],
    };
  }

  if (artist) {
    chat.style.description = `Custom import by ${artist}`;
  }

  // Cover art persistence from data URL
  if (coverArtUrl && typeof coverArtUrl === 'string' && coverArtUrl.startsWith('data:image/')) {
    try {
      const parts = coverArtUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const buffer = Buffer.from(parts[1], 'base64');
      fs.writeFileSync(path.join(dirPath, `cover.${ext}`), buffer);
      chat.coverArtUrl = `/api/audio/${chat.id}/cover?t=${Date.now()}`;
    } catch (e) {
      console.warn('Cover art persistence notice:', e);
    }
  }

  // Lyrics persistence
  if (lrcContent && typeof lrcContent === 'string') {
    const lrcPath = path.join(dirPath, `${chat.folderName}_synced.lrc`);
    fs.writeFileSync(lrcPath, lrcContent, 'utf-8');
    if (chat.versions && chat.versions.length > 0) {
      chat.versions[chat.versions.length - 1].leadSheetFile = `${chat.folderName}_synced.lrc`;
    }
    chat.lyrics = parseLrcToLyricsMap(lrcContent);
  } else if (lyrics && typeof lyrics === 'string') {
    chat.lyrics = parseLrcToLyricsMap(lyrics);
  }

  saveChat(chat);
  broadcastEvent({
    type: 'chats_updated',
    message: `Updated metadata for "${chat.name}"`,
    payload: { id: chat.id, name: chat.name },
  });

  return res.json({ success: true, chat });
};

app.patch('/api/chats/:id/metadata', handleChatMetadataUpdate);
app.post('/api/chats/:id/metadata', handleChatMetadataUpdate);

app.post('/api/chats/:id/cover-art', upload.single('cover'), async (req, res) => {
  const chatId = req.params.id as string;
  const resolved = await resolveChatDirectory(chatId);
  if (!resolved) return res.status(404).json({ error: 'Chat not found' });

  const { chat, dirPath } = resolved;
  if (!req.file) return res.status(400).json({ error: 'No cover file provided' });

  const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  fs.writeFileSync(path.join(dirPath, `cover.${ext}`), req.file.buffer);
  chat.coverArtUrl = `/api/audio/${chat.id}/cover?t=${Date.now()}`;
  saveChat(chat);

  broadcastEvent({
    type: 'chats_updated',
    message: `Updated cover art for "${chat.name}"`,
    payload: { id: chat.id, coverUrl: chat.coverArtUrl },
  });

  return res.json({ success: true, coverUrl: chat.coverArtUrl });
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

app.post('/api/chats/:id/video/render', async (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) return res.status(404).json({ error: 'Chat not found' });

  const { dirPath, chat } = result;
  const files = fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
  let mp3File = files.find(f => f.endsWith('.mp3'));
  if (!mp3File) {
    return res.status(400).json({ error: 'No audio MP3 found in project to render video from' });
  }

  const mp3Path = path.join(dirPath, mp3File);
  const videoDir = path.join(dirPath, 'video');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
  const outMp4Path = path.join(videoDir, 'video_master.mp4');

  let coverPath = path.join(dirPath, 'cover.jpg');
  if (!fs.existsSync(coverPath)) {
    const pngCover = path.join(dirPath, 'cover.png');
    if (fs.existsSync(pngCover)) {
      coverPath = pngCover;
    } else {
      // Try extracting embedded ID3 cover from MP3
      const extracted = extractEmbeddedId3(mp3Path);
      if (extracted.cover) {
        fs.writeFileSync(coverPath, extracted.cover);
      } else {
        // Generate SVG cover badge and convert to JPG for video background
        const artist = chat.style?.description?.replace(/^Custom import by\s*/i, '') || 'MusicSkills Studio';
        const svg = generateCoverArtSvg(chat.name, artist);
        const tempSvgPath = path.join(dirPath, 'cover_temp.svg');
        fs.writeFileSync(tempSvgPath, svg, 'utf-8');
        try {
          await execFileAsync('ffmpeg', ['-y', '-i', tempSvgPath, coverPath]);
        } catch (_) {}
        try {
          if (fs.existsSync(tempSvgPath)) fs.unlinkSync(tempSvgPath);
        } catch (_) {}
      }
    }
  }

  const style = req.body?.style || (fs.existsSync(coverPath) ? 'album-art' : 'spectrum');

  try {
    let cmd = '';
    if (style === 'spectrum') {
      cmd = `ffmpeg -y -i "${mp3Path}" -filter_complex "[0:a]showfreqs=s=1920x1080:mode=bar:ascale=log:fscale=log:colors=0x6E44FF|0x3CC4B2[v]" -map "[v]" -map 0:a -c:v libx264 -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "${outMp4Path}"`;
    } else if (style === 'waveform' || !fs.existsSync(coverPath)) {
      cmd = `ffmpeg -y -i "${mp3Path}" -filter_complex "[0:a]showwaves=s=1920x1080:mode=line:colors=0x6E44FF[v]" -map "[v]" -map 0:a -c:v libx264 -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "${outMp4Path}"`;
    } else {
      cmd = `ffmpeg -y -loop 1 -i "${coverPath}" -i "${mp3Path}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -shortest "${outMp4Path}"`;
    }

    await execFileAsync('sh', ['-c', cmd], { timeout: 120000 });
    if (fs.existsSync(outMp4Path)) {
      broadcastEvent({
        type: 'chats_updated',
        message: `Rendered 1080p video master for "${chat.name}"`,
        payload: { id: chat.id, file: 'video/video_master.mp4' },
      });

      return res.json({
        success: true,
        videoFile: 'video_master.mp4',
        downloadUrl: `/api/chats/${chat.id}/video/download`,
      });
    } else {
      throw new Error('Video render process finished without output file');
    }
  } catch (err: any) {
    console.error('Video render failed:', err);
    res.status(500).json({ error: err.message || 'Video render failed' });
  }
});

app.get('/api/chats/:id/video/download', (req, res) => {
  const result = getChat(req.params.id as string);
  if (!result) return res.status(404).json({ error: 'Chat not found' });
  const videoPath = path.join(result.dirPath, 'video', 'video_master.mp4');
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Rendered video master not found. Please render the video first.' });
  }
  res.download(videoPath, `${sanitizeName(result.chat.name)}_visualizer.mp4`);
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

  // If the AI co-writer proposed new lyrics sections, automatically incorporate them
  if (assistantReply.includes('[') && assistantReply.includes(']')) {
    const parsedSections = parseLrcToLyricsMap(assistantReply);
    if (Object.keys(parsedSections).length > 0) {
      chat.lyrics = { ...(chat.lyrics || {}), ...parsedSections };
    }
  }

  saveChat(chat);
  broadcastEvent({
    type: 'chats_updated',
    message: `AI Co-Writer updated "${chat.name}"`,
    payload: { id: chat.id },
  });
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

async function resolveChatDirectory(chatId: string, titleHint?: string): Promise<{ dirPath: string; chat: ChatSession } | null> {
  if (!chatId && !titleHint) return null;

  // 1. Direct getChat with chatId
  if (chatId) {
    const res = getChat(chatId);
    if (res) return res;
  }

  // 2. Direct getChat with titleHint
  if (titleHint) {
    const res = getChat(titleHint);
    if (res) return res;
  }

  // 3. Fallback scan of .chats/
  const chatsDir = getChatsDir();
  if (!fs.existsSync(chatsDir)) return null;

  const entries = fs.readdirSync(chatsDir, { withFileTypes: true });
  const cleanId = chatId ? sanitizeName(chatId) : '';
  const cleanHint = titleHint ? sanitizeName(titleHint) : '';

  // Scan chat.json in each folder
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(chatsDir, entry.name);
    const metaPath = path.join(dirPath, 'chat.json');
    if (!fs.existsSync(metaPath)) continue;

    try {
      const chat = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ChatSession;
      const chatNameLower = (chat.name || '').trim().toLowerCase();
      const folderLower = entry.name.toLowerCase();

      // Check against titleHint
      if (titleHint && (
        chatNameLower === titleHint.trim().toLowerCase() ||
        sanitizeName(chat.name || '') === cleanHint ||
        folderLower.includes(cleanHint)
      )) {
        chat.folderName = entry.name;
        return { dirPath, chat };
      }

      // Check against chatId
      if (chatId && (
        (chat.id && chat.id.toLowerCase() === chatId.toLowerCase()) ||
        chatNameLower === chatId.trim().toLowerCase() ||
        sanitizeName(chat.name || '') === cleanId ||
        folderLower.includes(cleanId)
      )) {
        chat.folderName = entry.name;
        return { dirPath, chat };
      }
    } catch (_) {}
  }

  return null;
}

async function handleAudioRequest(req: express.Request, res: express.Response) {
  const chatId = req.params.chatId as string;
  const titleHint = (req.query.title as string) || (req.query.name as string) || (req.query.song as string);
  if (!chatId && !titleHint) return res.status(400).send('Chat ID or Song Title is required');

  let resolved = await resolveChatDirectory(chatId, titleHint);
  if (!resolved) {
    try {
      await autoIntakeOutputs();
      resolved = await resolveChatDirectory(chatId, titleHint);
    } catch (_) {}
  }

  if (!resolved) {
    return res.status(404).send('Audio track or project not found');
  }

  const { dirPath, chat } = resolved;
  const reqFilename = req.params.filename as string | undefined;
  let filePath: string | null = null;

  // 1. If explicit filename provided and exists
  if (reqFilename && reqFilename !== 'undefined' && reqFilename !== 'null') {
    const candidate = path.join(dirPath, reqFilename);
    if (fs.existsSync(candidate)) {
      filePath = candidate;
    }
  }

  // 2. If not found, check chat.versions for latest mp3File
  if (!filePath && chat.versions && chat.versions.length > 0) {
    const latest = chat.versions[chat.versions.length - 1];
    if (latest.mp3File) {
      const candidate = path.join(dirPath, latest.mp3File);
      if (fs.existsSync(candidate)) filePath = candidate;
    }
  }

  // 3. If not found, look for v1_custom.mp3 or any audio file in dirPath
  if (!filePath && fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    const v1 = files.find(f => f === 'v1_custom.mp3');
    if (v1) {
      filePath = path.join(dirPath, v1);
    } else {
      const anyAudio = files.find(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.flac') || f.endsWith('.ogg') || f.endsWith('.m4a'));
      if (anyAudio) filePath = path.join(dirPath, anyAudio);
    }
  }

  // 4. If requested MP3 does not exist on disk, but a MIDI file exists: ON-DEMAND TRANSCRIBE!
  if (!filePath) {
    const files = fs.readdirSync(dirPath);
    const anyMid = files.find(f => f.endsWith('.mid'));
    if (anyMid) {
      const midiPath = path.join(dirPath, anyMid);
      const synthMp3Path = path.join(dirPath, `${path.basename(anyMid, '.mid')}.mp3`);
      try {
        await renderMidiToAudio(midiPath, synthMp3Path);
        if (fs.existsSync(synthMp3Path)) {
          filePath = synthMp3Path;
          if (chat.versions.length > 0) {
            chat.versions[chat.versions.length - 1].mp3File = path.basename(synthMp3Path);
            saveChat(chat);
          }
        }
      } catch (synthErr) {
        console.warn('On-demand audio synthesis error:', synthErr);
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Audio file not found');
  }

  const isMp3 = filePath.endsWith('.mp3');
  const isWav = filePath.endsWith('.wav');
  const isMid = filePath.endsWith('.mid');
  const isFlac = filePath.endsWith('.flac');
  const isOgg = filePath.endsWith('.ogg');
  const isM4a = filePath.endsWith('.m4a');
  const contentType = isMp3
    ? 'audio/mpeg'
    : isWav
    ? 'audio/wav'
    : isMid
    ? 'audio/midi'
    : isFlac
    ? 'audio/flac'
    : isOgg
    ? 'audio/ogg'
    : isM4a
    ? 'audio/mp4'
    : 'application/octet-stream';

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

function generateCoverArtSvg(title: string, artist: string = 'MusicSkills Studio'): string {
  const cleanTitle = (title || 'Studio Track').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 32);
  const cleanArtist = (artist || 'MusicSkills Studio').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 28);
  const initials = cleanTitle.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'MS';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B1530"/>
      <stop offset="50%" stop-color="#0E0D18"/>
      <stop offset="100%" stop-color="#07060B"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6E44FF"/>
      <stop offset="100%" stop-color="#3CC4B2"/>
    </linearGradient>
    <linearGradient id="disc" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14131D"/>
      <stop offset="100%" stop-color="#0A0910"/>
    </linearGradient>
  </defs>
  <rect width="500" height="500" rx="16" fill="url(#bg)"/>
  <!-- Concentric Grooves -->
  <circle cx="250" cy="210" r="150" fill="url(#disc)" stroke="#262338" stroke-width="2"/>
  <circle cx="250" cy="210" r="130" fill="none" stroke="#221F33" stroke-width="1.5" stroke-dasharray="4 4"/>
  <circle cx="250" cy="210" r="110" fill="none" stroke="#1E1B2D" stroke-width="1"/>
  <circle cx="250" cy="210" r="90" fill="none" stroke="#262338" stroke-width="1.5"/>
  <circle cx="250" cy="210" r="70" fill="none" stroke="#1E1B2D" stroke-width="1" stroke-dasharray="6 3"/>
  <!-- Center Spindle -->
  <circle cx="250" cy="210" r="50" fill="url(#accent)"/>
  <circle cx="250" cy="210" r="14" fill="#07060B"/>
  <text x="250" y="217" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="900" fill="#FFFFFF" text-anchor="middle">${initials}</text>
  <!-- Track Typography -->
  <text x="250" y="415" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF" text-anchor="middle">${cleanTitle}</text>
  <text x="250" y="445" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#9D9AB4" text-anchor="middle">${cleanArtist}</text>
</svg>`;
}

async function handleCoverRequest(req: express.Request, res: express.Response) {
  const chatId = req.params.chatId as string;
  const titleHint = (req.query.title as string) || (req.query.name as string);

  let resolved = await resolveChatDirectory(chatId, titleHint);
  if (!resolved) {
    try {
      await autoIntakeOutputs();
      resolved = await resolveChatDirectory(chatId, titleHint);
    } catch (_) {}
  }

  if (resolved) {
    const { dirPath, chat } = resolved;
    const coverFiles = ['cover.jpg', 'cover.png', 'cover.webp', 'album.jpg', 'folder.jpg', 'art.jpg'];
    for (const cf of coverFiles) {
      const p = path.join(dirPath, cf);
      if (fs.existsSync(p)) {
        const ext = path.extname(cf).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return res.sendFile(path.resolve(p), { dotfiles: 'allow', headers: { 'Content-Type': mime } });
      }
    }

    // On-demand extraction of APIC from MP3
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      const mp3 = files.find(f => f.endsWith('.mp3'));
      if (mp3) {
        const mp3Path = path.join(dirPath, mp3);
        const extracted = extractEmbeddedId3(mp3Path);
        if (extracted.cover) {
          const coverJpg = path.join(dirPath, 'cover.jpg');
          fs.writeFileSync(coverJpg, extracted.cover);
          return res.sendFile(path.resolve(coverJpg), { dotfiles: 'allow', headers: { 'Content-Type': extracted.mime || 'image/jpeg' } });
        }
      }
    }

    const artist = chat.style?.description?.replace(/^Custom import by\s*/i, '') || 'MusicSkills Studio';
    const svg = generateCoverArtSvg(chat.name, artist);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(svg);
  }

  // Fallback dynamic SVG cover badge
  const fallbackTitle = titleHint || chatId || 'Studio Track';
  const svg = generateCoverArtSvg(fallbackTitle, 'MusicSkills Studio');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.send(svg);
}

app.get(['/api/audio/:chatId/cover', '/api/chats/:chatId/cover'], handleCoverRequest);
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
    const versionNum = result.chat.versions.length + 1;
    const versionLabel = `v${versionNum}`;
    const outputFilename = `${result.chat.folderName}_${versionLabel}_mixed.mp3`;

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

    let durationSec = 180;
    try {
      const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path.join(result.dirPath, outputFilename)}"`;
      const durOut = await execFileAsync('sh', ['-c', durCmd]);
      const parsedDur = parseFloat(durOut.stdout.trim());
      if (!isNaN(parsedDur) && parsedDur > 0) durationSec = Math.round(parsedDur);
    } catch (_) {}

    const newVersion = {
      version: versionLabel,
      createdAt: new Date().toISOString(),
      bpm: result.chat.style.bpm || 120,
      key: result.chat.style.key || 'C',
      midiFile: '',
      mp3File: outputFilename,
      leadSheetFile: result.chat.versions[result.chat.versions.length - 1]?.leadSheetFile || '',
      durationSec,
      notes: `Vocal Studio Master Mix (${versionLabel})`,
    };

    result.chat.versions.push(newVersion);
    saveChat(result.chat);

    broadcastEvent({
      type: 'chats_updated',
      message: `Rendered vocal studio mix (${versionLabel}) for "${result.chat.name}"`,
      payload: { id: result.chat.id, version: newVersion },
    });

    res.json({ success: true, mixedFile, version: newVersion, chat: result.chat });
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

// --- AI PYTHON CODE GENERATION & COMPOSITION EXECUTION ROUTES ---

app.post('/api/ai/code/generate', async (req, res) => {
  const { chatId, topic, genre, mood, bpm, key, sections, instructions } = req.body;
  let chatDir = '';
  let chatName = topic || 'New Song';
  let chatStyle: any = {};

  if (chatId) {
    const chatResult = getChat(chatId);
    if (chatResult) {
      chatDir = chatResult.dirPath;
      chatName = chatResult.chat.name;
      chatStyle = chatResult.chat.style || {};
    }
  }

  try {
    const genResult = await generatePythonMusicCode({
      topic: topic || chatName,
      genre: genre || chatStyle.genre || 'pop',
      mood: mood || (chatStyle.moods && chatStyle.moods[0]) || 'energetic',
      bpm: bpm || chatStyle.bpm || 120,
      key: key || chatStyle.key || 'C',
      sections,
      instructions,
      baseName: 'composition',
    });

    if (chatDir && fs.existsSync(chatDir)) {
      const targetFile = path.join(chatDir, 'composition.py');
      fs.writeFileSync(targetFile, genResult.code, 'utf-8');
    }

    res.json({
      success: true,
      ...genResult,
    });
  } catch (err: any) {
    console.error('AI code generation failed:', err);
    res.status(500).json({ error: err.message || 'AI code generation failed' });
  }
});

app.post('/api/ai/code/edit', async (req, res) => {
  const { chatId, code, instruction } = req.body;
  if (!code || !instruction) {
    return res.status(400).json({ error: 'Both code and instruction are required' });
  }

  try {
    const editResult = await editPythonMusicCode(code, instruction);
    if (chatId) {
      const chatResult = getChat(chatId);
      if (chatResult && fs.existsSync(chatResult.dirPath)) {
        const targetFile = path.join(chatResult.dirPath, 'composition.py');
        fs.writeFileSync(targetFile, editResult.code, 'utf-8');
      }
    }

    res.json({
      success: true,
      ...editResult,
    });
  } catch (err: any) {
    console.error('AI code editing failed:', err);
    res.status(500).json({ error: err.message || 'AI code editing failed' });
  }
});

app.post('/api/ai/code/render', async (req, res) => {
  const { chatId, code } = req.body;
  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  const result = getChat(chatId);
  if (!result) return res.status(404).json({ error: 'Chat not found' });

  const { chat, dirPath } = result;
  const pythonBin = fs.existsSync(path.resolve(process.cwd(), '.venv/bin/python'))
    ? path.resolve(process.cwd(), '.venv/bin/python')
    : 'python3';

  const compPath = path.join(dirPath, 'composition.py');
  if (code) {
    fs.writeFileSync(compPath, code, 'utf-8');
  } else if (!fs.existsSync(compPath)) {
    const generated = await generatePythonMusicCode({
      topic: chat.style.topic || chat.name,
      genre: chat.style.genre || 'pop',
      mood: (chat.style.moods && chat.style.moods[0]) || 'energetic',
      bpm: chat.style.bpm || 120,
      key: chat.style.key || 'C',
      baseName: `${chat.folderName}_custom`,
    });
    fs.writeFileSync(compPath, generated.code, 'utf-8');
  }

  const versionNum = chat.versions.length + 1;
  const versionLabel = `v${versionNum}`;
  const baseName = `${chat.folderName}_${versionLabel}`;
  const midiPath = path.join(dirPath, `${baseName}.mid`);
  const mp3Path = path.join(dirPath, `${baseName}.mp3`);

  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, [compPath, midiPath], {
      cwd: dirPath,
      timeout: 45000,
    });

    if (!fs.existsSync(midiPath)) {
      const files = fs.readdirSync(dirPath);
      const generatedMid = files.find(f => f.endsWith('.mid'));
      if (generatedMid) {
        fs.renameSync(path.join(dirPath, generatedMid), midiPath);
      } else {
        throw new Error(`Python script did not produce MIDI output at ${midiPath}. Output: ${stderr || stdout}`);
      }
    }

    await renderMidiToAudio(midiPath, mp3Path);

    let durationSec = 180;
    try {
      const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mp3Path}"`;
      const durOut = await execFileAsync('sh', ['-c', durCmd]);
      const parsedDur = parseFloat(durOut.stdout.trim());
      if (!isNaN(parsedDur) && parsedDur > 0) durationSec = Math.round(parsedDur);
    } catch (_) {}

    const peaks = await extractWaveformPeaks(mp3Path, 100);

    const newVersion = {
      version: versionLabel,
      createdAt: new Date().toISOString(),
      bpm: chat.style.bpm || 120,
      key: chat.style.key || 'C',
      midiFile: `${baseName}.mid`,
      mp3File: fs.existsSync(mp3Path) ? `${baseName}.mp3` : '',
      leadSheetFile: `${baseName}_lead_sheet.md`,
      durationSec,
      notes: `Rendered from custom AI Python script (${versionLabel})`,
    };

    chat.versions.push(newVersion);
    chat.step = 'result';
    saveChat(chat);

    broadcastEvent({
      type: 'chats_updated',
      message: `Rendered custom Python music master (${versionLabel}) for "${chat.name}"`,
      payload: { id: chat.id, version: newVersion },
    });

    res.json({
      success: true,
      version: newVersion,
      peaks,
      chat,
      stdout,
    });
  } catch (err: any) {
    console.error('Python script execution and render failed:', err);
    res.status(500).json({ error: err.message || 'Python script execution failed' });
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

interface ScannedOutputItem {
  fullPath: string;
  relPath: string;
  dirName: string;
  fileName: string;
  baseName: string;
  ext: string;
}

function scanOutputsRecursively(dir: string, baseDir = dir): ScannedOutputItem[] {
  let results: ScannedOutputItem[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(scanOutputsRecursively(full, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const baseName = path.basename(entry.name, ext);
      const rel = path.relative(baseDir, full);
      results.push({
        fullPath: full,
        relPath: rel,
        dirName: path.dirname(rel) === '.' ? '' : path.dirname(rel),
        fileName: entry.name,
        baseName,
        ext,
      });
    }
  }
  return results;
}

async function autoIntakeOutputs() {
  const outputsDir = path.resolve(process.cwd(), 'outputs');
  if (!fs.existsSync(outputsDir)) return;
  const allEntries = scanOutputsRecursively(outputsDir);

  // Group by directory + baseName
  const groups = new Map<string, {
    baseName: string;
    dirName: string;
    relPath: string;
    title: string;
    midPath?: string;
    audioPath?: string;
    lrcPath?: string;
    coverPath?: string;
  }>();

  for (const item of allEntries) {
    const key = `${item.dirName}:::${item.baseName.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        baseName: item.baseName,
        dirName: item.dirName,
        relPath: item.relPath,
        title: item.baseName.replace(/[_-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      });
    }

    const grp = groups.get(key)!;
    if (item.ext === '.mid' || item.ext === '.midi') {
      grp.midPath = item.fullPath;
    } else if (['.mp3', '.wav', '.flac', '.ogg'].includes(item.ext)) {
      grp.audioPath = item.fullPath;
    } else if (item.ext === '.lrc' || item.ext === '.txt') {
      grp.lrcPath = item.fullPath;
    } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(item.ext)) {
      grp.coverPath = item.fullPath;
    }
  }

  const existingChats = listChats();

  for (const group of groups.values()) {
    // Requires at least one audio or MIDI asset
    if (!group.midPath && !group.audioPath) continue;

    const existing = existingChats.find(
      c => c.folderName.startsWith(group.baseName) || c.name.toLowerCase() === group.title.toLowerCase()
    );
    if (existing) continue;

    let genre = 'pop';
    const lowerDir = group.dirName.toLowerCase();
    if (lowerDir.includes('indian')) genre = 'indian';
    else if (lowerDir.includes('rock')) genre = 'rock';
    else if (lowerDir.includes('phonk')) genre = 'phonk';
    else if (lowerDir.includes('electronic')) genre = 'electronic';
    else if (lowerDir.includes('hip-hop') || lowerDir.includes('rap')) genre = 'hip-hop';

    const newChat = createChat(group.title, {
      topic: group.title,
      genre,
      bpm: 120,
    });
    const targetDir = path.join(getChatsDir(), newChat.folderName);
    const targetMp3 = `${newChat.folderName}_v1.mp3`;
    const targetMp3Path = path.join(targetDir, targetMp3);
    const targetMid = `${newChat.folderName}_v1.mid`;
    const targetMidPath = path.join(targetDir, targetMid);

    // Copy or transcode MIDI
    if (group.midPath && fs.existsSync(group.midPath)) {
      fs.copyFileSync(group.midPath, targetMidPath);
    }

    // Audio file resolution
    if (group.audioPath && fs.existsSync(group.audioPath)) {
      if (group.audioPath.endsWith('.mp3')) {
        fs.copyFileSync(group.audioPath, targetMp3Path);
      } else {
        // Transcode non-MP3 audio to MP3 using ffmpeg
        try {
          await execFileAsync('ffmpeg', ['-y', '-i', group.audioPath, '-b:a', '192k', targetMp3Path]);
        } catch (_) {
          fs.copyFileSync(group.audioPath, targetMp3Path);
        }
      }
    } else if (group.midPath) {
      try {
        await renderMidiToAudio(group.midPath, targetMp3Path);
      } catch (e) {
        console.warn(`Could not render audio for auto-intake ${group.title}:`, e);
      }
    }

    // Lyrics resolution
    let lyricsMap: Record<string, string[]> = {};
    let lrcFileName = '';
    if (group.lrcPath && fs.existsSync(group.lrcPath)) {
      lrcFileName = `${newChat.folderName}_v1.lrc`;
      fs.copyFileSync(group.lrcPath, path.join(targetDir, lrcFileName));
      const lrcContent = fs.readFileSync(group.lrcPath, 'utf-8');
      lyricsMap = parseLrcToLyricsMap(lrcContent);
    } else if (fs.existsSync(targetMp3Path)) {
      const embedded = extractEmbeddedId3(targetMp3Path);
      if (embedded.lyrics) {
        lrcFileName = `${newChat.folderName}_v1.lrc`;
        fs.writeFileSync(path.join(targetDir, lrcFileName), embedded.lyrics, 'utf-8');
        lyricsMap = parseLrcToLyricsMap(embedded.lyrics);
      } else {
        lyricsMap = { 'Lyrics': ['[Ready for lyrics synchronization]'] };
      }
    } else {
      lyricsMap = { 'Lyrics': ['[Ready for lyrics synchronization]'] };
    }
    newChat.lyrics = lyricsMap;

    // Cover art resolution
    if (group.coverPath && fs.existsSync(group.coverPath)) {
      fs.copyFileSync(group.coverPath, path.join(targetDir, 'cover.jpg'));
    } else if (fs.existsSync(targetMp3Path)) {
      const embedded = extractEmbeddedId3(targetMp3Path);
      if (embedded.cover) {
        fs.writeFileSync(path.join(targetDir, 'cover.jpg'), embedded.cover);
      }
    }

    // Real duration detection
    let durationSec = 180;
    try {
      if (fs.existsSync(targetMp3Path)) {
        const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetMp3Path}"`;
        const durOut = await execFileAsync('sh', ['-c', durCmd]);
        const parsedDur = parseFloat(durOut.stdout.trim());
        if (!isNaN(parsedDur) && parsedDur > 0) durationSec = Math.round(parsedDur);
      }
    } catch (_) {}

    newChat.versions.push({
      version: 'v1',
      createdAt: new Date().toISOString(),
      bpm: 120,
      key: 'C',
      midiFile: fs.existsSync(targetMidPath) ? targetMid : '',
      mp3File: fs.existsSync(targetMp3Path) ? targetMp3 : '',
      leadSheetFile: lrcFileName,
      durationSec,
      notes: `Auto-imported from outputs/${group.relPath}`,
    });

    saveChat(newChat);
    broadcastEvent({
      type: 'chats_updated',
      message: `Auto-imported external project: "${group.title}" (${genre})`,
      payload: { id: newChat.id, name: group.title },
    });
  }
}

function setupFileWatchers() {
  const chatsDir = getChatsDir();
  try {
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true });
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
  } catch (e) {
    console.warn('Could not watch .chats directory:', e);
  }

  // Watch outputs/ directory for external AI tools
  const outputsDir = path.resolve(process.cwd(), 'outputs');
  try {
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    fs.watch(outputsDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      if (/\.(mid|midi|mp3|wav|flac|ogg|lrc|txt|jpg|png|json)$/i.test(filename)) {
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

  // Strict API route guard: guarantees /api requests never return HTML fallback
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl || req.path}` });
  });

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
      app.use((req, res) => {
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

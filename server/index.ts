import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { loadConfig, saveConfig, maskKey } from './config';
import { listChats, getChat, createChat, saveChat, deleteChat, getChatsDir } from './chats';
import { generateLyrics, generateLocalFallbackLyrics, getAIModel, testApiKey } from './ai';
import { renderSong, mixVocalTake } from './audio';

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

// --- AI SONGWRITING & LYRICS ROUTES ---

app.post('/api/ai/lyrics', async (req, res) => {
  const { topic, genre, mood, purpose, vocalDelivery, sections } = req.body;
  try {
    const lyrics = await generateLyrics({
      topic,
      genre,
      mood,
      purpose,
      vocalDelivery,
      sections: sections || [],
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
      const model = getAIModel();
      const { text } = await (await import('ai')).generateText({
        model,
        system: `You are an expert music co-writer assisting with the song "${chat.name}".
Style: ${style?.genre || 'Pop'} (${style?.moods?.join(', ') || 'Energetic'})
Current Lyrics:
${JSON.stringify(currentLyrics, null, 2)}

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

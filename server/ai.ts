import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { loadConfig } from './config';

export function getAIModel(overrideProvider?: string, overrideKey?: string, overrideModel?: string) {
  const config = loadConfig();
  const provider = overrideProvider || config.provider || 'anthropic';
  const apiKey = overrideKey || config.apiKey || '';
  const modelName = overrideModel || config.model;

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey });
    return anthropic(modelName || 'claude-sonnet-5-5');
  } else if (provider === 'openai') {
    const openai = createOpenAI({ apiKey });
    return openai(modelName || 'gpt-5.5');
  } else if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelName || 'gemini-4-argon');
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

export async function testApiKey(
  provider: 'anthropic' | 'openai' | 'google',
  model: string,
  apiKey: string
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { ok: false, message: 'API key cannot be empty' };
  }

  const startTime = Date.now();
  try {
    const modelInstance = getAIModel(provider, apiKey.trim(), model);
    const result = await generateText({
      model: modelInstance,
      prompt: 'Respond with exactly one word: OK',
      maxOutputTokens: 5,
    });

    const latencyMs = Date.now() - startTime;
    if (result.text && result.text.length > 0) {
      return { ok: true, message: `Connected to ${provider} (${model}) in ${latencyMs}ms`, latencyMs };
    }
    return { ok: false, message: 'Empty response received from provider' };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Failed to authenticate with provider',
      latencyMs: Date.now() - startTime,
    };
  }
}

export async function fetchLRCLibReference(
  query: string
): Promise<{ trackName: string; artistName: string; lyricsText: string; syncedLyrics?: string } | null> {
  try {
    let cleanQuery = query.trim();
    const match = query.match(/(?:based on|lyrics of|like|inspired by)\s+(?:the\s+lyrics\s+of\s+)?["']?([^"']+)["']?/i);
    if (match) {
      cleanQuery = match[1].trim();
    }

    const encoded = encodeURIComponent(cleanQuery);
    const res = await fetch(`https://lrclib.net/api/search?q=${encoded}`, {
      headers: {
        'User-Agent': 'MusicSkills-Studio/1.0.0 (https://github.com/Aarav90-cpu/MusicSkills)',
        'Lrclib-Client': 'MusicSkills-Studio/1.0.0',
      },
    });

    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        const best = records.find((r: any) => Boolean(r.plainLyrics || r.syncedLyrics)) || records[0];
        const rawLyrics = best.plainLyrics || (best.syncedLyrics ? best.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim() : '');
        if (rawLyrics) {
          return {
            trackName: best.trackName,
            artistName: best.artistName,
            lyricsText: rawLyrics,
            syncedLyrics: best.syncedLyrics || undefined,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[AI Engine] Failed to query LRCLIB for baseline:', err);
  }
  return null;
}

export async function generateLyrics(params: {
  topic: string;
  genre: string;
  mood: string;
  purpose: string;
  vocalDelivery: string;
  sections: Array<{ name: string; type: string; bars: number }>;
  referenceSong?: string;
  referenceLyrics?: string;
}): Promise<Record<string, string[]>> {
  const config = loadConfig();

  // If no API key configured, use procedural genre-specific generation
  if (!config.apiKey || config.apiKey.trim().length === 0) {
    return generateLocalFallbackLyrics(params);
  }

  // Attempt generation with automatic retry
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const model = getAIModel();
      const targetSections = (params.sections && params.sections.length > 0)
        ? params.sections.filter(s => s.type !== 'intro' && s.type !== 'outro' && s.type !== 'instrumental_break').map(s => s.name)
        : ['Verse 1', 'Pre-Chorus', 'Chorus 1', 'Verse 2', 'Chorus 2', 'Bridge', 'Chorus 3'];

      let baselineContext = '';
      if (params.referenceLyrics) {
        baselineContext = `\nReference Song Baseline:\n${params.referenceLyrics}\n`;
      } else if (
        params.referenceSong ||
        params.topic.toLowerCase().includes('based on') ||
        params.topic.toLowerCase().includes('lyrics of') ||
        params.topic.toLowerCase().includes('inspired by')
      ) {
        const queryToSearch = params.referenceSong || params.topic;
        const ref = await fetchLRCLibReference(queryToSearch);
        if (ref) {
          baselineContext = `\nReference Baseline Song: "${ref.trackName}" by ${ref.artistName}\nBaseline Lyrics:\n${ref.lyricsText}\n\nInstruction: Write an original song inspired by the themes, rhyme cadence, and narrative arc of this baseline track. Do not copy lines verbatim; reinterpret the imagery and emotion into ${params.genre}.\n`;
        }
      }

      const systemPrompt = `You are an elite music lyricist and vocal arranger.
Genre: ${params.genre}
Mood: ${params.mood}
Purpose: ${params.purpose}
Vocal Style: ${params.vocalDelivery}
Topic: ${params.topic}${baselineContext}

Structure your output strictly by section:
[Section Name]
Line 1
Line 2
Line 3
Line 4

Rules:
1. Write rhythmic, singable lyrical phrases matching natural vocal breath pauses.
2. Maintain metric rhyming appropriate to ${params.genre}.
3. Provide lyrics for each of these sections: ${targetSections.join(', ')}.
4. Do not include introductory conversational banter or concluding markdown commentary.
5. Strictly zero emojis anywhere.`;

      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: `Write complete, original lyrics about "${params.topic}". Keep the tone authentic to ${params.genre} with a ${params.mood} energy.`,
        temperature: config.creativity ?? 0.7,
      });

      const parsed = parseLyricsOutput(text, targetSections);
      if (Object.keys(parsed).length > 0) {
        return ensureSectionsComplete(parsed, params, targetSections);
      }
    } catch (err: any) {
      console.warn(`[AI Engine] Attempt ${attempt} failed:`, err.message || err);
      if (attempt === maxAttempts) {
        console.warn('[AI Engine] Falling back to procedural lyrical composition.');
        return generateLocalFallbackLyrics(params);
      }
      // Short delay before retry
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  return generateLocalFallbackLyrics(params);
}

export function parseLyricsOutput(text: string, expectedSections?: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let currentSection = 'Verse 1';

  // Remove code blocks if present
  let cleanText = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');

  const lines = cleanText.split('\n');
  const sectionHeaderRegex = /^(?:\[|\#{1,4}\s*|\*{1,2})?([A-Za-z0-9\s\-_()]+?)(?:\]|\:|\*{1,2})?$/;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Detect section headers: [Verse 1], ## Chorus, **Bridge**, Verse 1:, etc.
    const isBracketed = trimmed.startsWith('[') && trimmed.endsWith(']');
    const isMarkdownHeader = trimmed.startsWith('#');
    const isColonHeader = /^[A-Za-z0-9\s]+:$/.test(trimmed);

    if (isBracketed || isMarkdownHeader || isColonHeader) {
      const cleanedName = trimmed
        .replace(/^[#\[\*\s]+/, '')
        .replace(/[#\]\*\:\s]+$/, '')
        .trim();

      if (cleanedName.length > 0) {
        currentSection = cleanedName;
        if (!result[currentSection]) result[currentSection] = [];
        continue;
      }
    }

    // Clean lyric lines: strip bullet dashes (- , * ), numbers (1. , 1) ), quotation marks
    let lineContent = trimmed
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+[\.\)]\s+/, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    if (lineContent.length > 0) {
      if (!result[currentSection]) result[currentSection] = [];
      result[currentSection].push(lineContent);
    }
  }

  return result;
}

function ensureSectionsComplete(
  lyrics: Record<string, string[]>,
  params: { topic: string; genre: string; mood: string },
  targetSections: string[]
): Record<string, string[]> {
  const fallback = generateLocalFallbackLyrics({
    topic: params.topic,
    genre: params.genre,
    mood: params.mood,
    purpose: '',
    vocalDelivery: '',
  });

  const output: Record<string, string[]> = { ...lyrics };

  for (const sec of targetSections) {
    // If section is missing or has fewer than 2 lines, supplement with fallback
    if (!output[sec] || output[sec].length < 2) {
      const fallbackLines = fallback[sec] || fallback['Verse 1'] || [
        `Riding the rhythm of ${params.topic} through the night`,
        `Holding the vision in the glowing city light`,
        `Stepping together where the future starts to shine`,
        `Leaving the shadows on the boundary line`,
      ];
      output[sec] = fallbackLines;
    }
  }

  return output;
}

export function generateLocalFallbackLyrics(params: {
  topic: string;
  genre: string;
  mood: string;
  purpose: string;
  vocalDelivery: string;
}): Record<string, string[]> {
  const t = params.topic || 'the dream';
  const genreLower = (params.genre || 'pop').toLowerCase();

  // Genre-Specific authentic lyrical templates
  if (genreLower.includes('phonk') || genreLower.includes('hip-hop') || genreLower.includes('rap')) {
    return {
      'Verse 1': [
        `Tires smoking on the asphalt, midnight in the rear-view glass`,
        `Chasing down ${t}, moving heavy on the mountain pass`,
        `Bassline hitting through the sub, shadows in the city haze`,
        `Count the miles on the meter, navigating through the maze`,
      ],
      'Pre-Chorus': [
        `Rev the engine up, feel the static in the sound`,
        `When the drop hits, we are never looking down`,
      ],
      'Chorus 1': [
        `This is ${t}! Drift across the boundary line!`,
        `Catch the spark ignite, make the neon city shine`,
        `Heavy on the low end, running till the break of day`,
        `Nothing in our path is ever getting in the way!`,
      ],
      'Verse 2': [
        `Red line flashing on the dash, tempo rising in the chest`,
        `Paid the price in full, put the doubts and fears to rest`,
        `Steering through the blind curves, headlights cutting clean`,
        `Writing out our legend on the asphalt in between`,
      ],
      'Chorus 2': [
        `This is ${t}! Drift across the boundary line!`,
        `Catch the spark ignite, make the neon city shine`,
        `Heavy on the low end, running till the break of day`,
        `Nothing in our path is ever getting in the way!`,
      ],
      'Bridge': [
        `Silence for a moment while the motor cools to black`,
        `Look across the distance, there is no retreating back`,
        `One click on the gear shift, grip the steering wheel`,
        `Everything is motion, everything is real!`,
      ],
      'Chorus 3': [
        `This is ${t}! Drift across the boundary line!`,
        `Catch the spark ignite, make the neon city shine!`,
        `Crown the new champion, take the final lap tonight!`,
        `Burning through the morning till the horizon turns to light!`,
      ],
      'Outro': [
        `Drifting through the night...`,
        `Living for ${t}...`,
      ],
    };
  }

  if (genreLower.includes('rock') || genreLower.includes('metal')) {
    return {
      'Verse 1': [
        `Feedback hums across the floor, waiting for the drum to strike`,
        `Walking down the iron road, holding what we used to like`,
        `Electric static in the air, searching for ${t} once again`,
        `Hear the chord progression break through the cold October rain`,
      ],
      'Pre-Chorus': [
        `Turn the gain up high, let the amplifier scream`,
        `Wake the sleeping heart from a faded hollow dream`,
      ],
      'Chorus 1': [
        `We scream for ${t}! Break the silence on the wall!`,
        `Tear the shadows down, we will answer to the call`,
        `Stand against the storm with our voices in the sky`,
        `Raise the anthem up, we will never wonder why!`,
      ],
      'Verse 2': [
        `Cables tangled on the stage, echoes of the open night`,
        `Every scar is evidence of another hard-won fight`,
        `Pushing past the cynics and the voices in the crowd`,
        `Living on the edge of sound, unapologetic and proud`,
      ],
      'Chorus 2': [
        `We scream for ${t}! Break the silence on the wall!`,
        `Tear the shadows down, we will answer to the call`,
        `Stand against the storm with our voices in the sky`,
        `Raise the anthem up, we will never wonder why!`,
      ],
      'Bridge': [
        `Single acoustic strum, whisper in the quiet air`,
        `Everything we suffered and the load we had to bear`,
        `Now the kick drum pounds like a pulse beneath the floor`,
        `Break the gates wide open, we will knock no more!`,
      ],
      'Chorus 3': [
        `We scream for ${t}! Break the silence on the wall!`,
        `Shatter every limit, we will conquer through it all!`,
        `Stand against the storm with our voices burning high`,
        `Victory is roaring beneath the open sky!`,
      ],
      'Outro': [
        `Reverberate into the dark...`,
        `This is ${t}...`,
      ],
    };
  }

  if (genreLower.includes('indian')) {
    return {
      'Verse 1': [
        `Morning ragas greet the dawn, colors shining in the breeze`,
        `Melodies of ${t} drifting through the temple trees`,
        `Tabla rhythms mark the beat, sitar strings begin to sing`,
        `Welcoming the joy that the celebration brings`,
      ],
      'Pre-Chorus': [
        `Feel the tempo rise, hear the ankle bells resound`,
        `Sacred celebration on this holy fertile ground`,
      ],
      'Chorus 1': [
        `Sing the song of ${t}, let the colors fly on high!`,
        `Joyous celebration lighting up the morning sky`,
        `Dance in harmony, let the festive music play`,
        `Every heart united on this radiant happy day!`,
      ],
      'Verse 2': [
        `Saffron, gold, and crimson dust dancing in the solar light`,
        `Stories told for centuries shining brilliantly and bright`,
        `Flute cascades across the square, laughter echoing around`,
        `Every step in unison to the ancient vibrant sound`,
      ],
      'Chorus 2': [
        `Sing the song of ${t}, let the colors fly on high!`,
        `Joyous celebration lighting up the morning sky`,
        `Dance in harmony, let the festive music play`,
        `Every heart united on this radiant happy day!`,
      ],
      'Bridge': [
        `Quiet prayer of gratitude as the midday sun ascends`,
        `Cherishing the brotherhood of our families and friends`,
        `Now the rhythm gathers speed, accelerating fast`,
        `Celebrate the future while honoring the past!`,
      ],
      'Chorus 3': [
        `Sing the song of ${t}, let the colors fly on high!`,
        `Joyous celebration echoing into the sky!`,
        `Blissful and triumphant, let the celebration ring`,
        `Hear the universe rejoice as the people sing!`,
      ],
      'Outro': [
        `Golden petals falling...`,
        `Blessed by ${t}...`,
      ],
    };
  }

  // Default Pop / EDM / Contemporary
  return {
    'Verse 1': [
      `Footsteps on the pavement as the morning starts to wake`,
      `Thinking about ${t} and the promises we make`,
      `Shadows fall behind us as the horizon turns to gold`,
      `Stepping toward the future and the story to unfold`,
    ],
    'Pre-Chorus': [
      `Feel the rising rhythm deep within the chest`,
      `There is no looking back now, put your doubts to rest`,
    ],
    'Chorus 1': [
      `This is our moment, living for ${t}!`,
      `Nothing in our path can ever hold us away`,
      `Hear the thunder rolling, burning through the sky`,
      `We will hold the flame and watch our banners fly!`,
    ],
    'Verse 2': [
      `Every road we traveled through the driving winter rain`,
      `Carried in our memories above the quiet pain`,
      `Now the road is open and the sky is running clear`,
      `Standing on the boundary with nothing left to fear`,
    ],
    'Chorus 2': [
      `This is our moment, living for ${t}!`,
      `Nothing in our path can ever hold us away`,
      `Hear the thunder rolling, burning through the sky`,
      `We will hold the flame and watch our banners fly!`,
    ],
    'Bridge': [
      `When the silence settles down and shadows clear away`,
      `A single spark of silver light begins to guide the way`,
      `It calls our name across the night, resilient and bold`,
      `Now witness how the greatest chapter finally is told!`,
    ],
    'Chorus 3': [
      `This is our moment, living for ${t}!`,
      `We shook the very ground and made the impossible true!`,
      `Hear the thunder rolling, shining in the light`,
      `Victory belongs to everyone tonight!`,
    ],
    'Outro': [
      `Living for ${t}...`,
      `Until the journey is done...`,
    ],
  };
}

import { generateText, streamText } from 'ai';
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
    return anthropic(modelName || 'claude-3-7-sonnet-20250219');
  } else if (provider === 'openai') {
    const openai = createOpenAI({ apiKey });
    return openai(modelName || 'gpt-4o');
  } else if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelName || 'gemini-2.0-flash');
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

export async function testApiKey(provider: 'anthropic' | 'openai' | 'google', model: string, apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, message: 'API key cannot be empty' };
  }

  try {
    const modelInstance = getAIModel(provider, apiKey, model);
    const result = await generateText({
      model: modelInstance,
      prompt: 'Respond with exactly one word: OK',
      maxOutputTokens: 5,
    });

    if (result.text && result.text.length > 0) {
      return { success: true, message: `Connected to ${provider} (${model})` };
    }
    return { success: false, message: 'No response received from provider' };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to authenticate with provider',
    };
  }
}

export async function generateLyrics(params: {
  topic: string;
  genre: string;
  mood: string;
  purpose: string;
  vocalDelivery: string;
  sections: Array<{ name: string; type: string; bars: number }>;
}): Promise<Record<string, string[]>> {
  const config = loadConfig();

  // If no API key configured, use local procedural generation
  if (!config.apiKey) {
    return generateLocalFallbackLyrics(params);
  }

  try {
    const model = getAIModel();
    const systemPrompt = `You are an elite songwriter and musical lyricist.
Your mission is to write singable, rhythmic, and poetic lyrics for a song.
Genre: ${params.genre}
Mood: ${params.mood}
Purpose: ${params.purpose}
Vocal Style: ${params.vocalDelivery}
Topic: ${params.topic}

Follow this exact format for each section:
[Section Name]
Line 1
Line 2
Line 3
Line 4

Write concise, rhythmic lines matching human breathing pauses.
Do not use emojis at any cost.
Sections to write: ${params.sections.filter(s => s.type !== 'intro' && s.type !== 'outro' && s.type !== 'instrumental_break').map(s => s.name).join(', ')}`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `Write original lyrics about "${params.topic}". Make it authentic to ${params.genre} with a ${params.mood} tone.`,
      temperature: config.creativity || 0.7,
    });

    return parseLyricsOutput(text);
  } catch (err) {
    console.warn('AI API call failed, using intelligent local lyrical engine:', err);
    return generateLocalFallbackLyrics(params);
  }
}

function parseLyricsOutput(text: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let currentSection = 'Verse 1';

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).trim();
      if (!result[currentSection]) result[currentSection] = [];
    } else {
      if (!result[currentSection]) result[currentSection] = [];
      result[currentSection].push(trimmed);
    }
  }
  return result;
}

export function generateLocalFallbackLyrics(params: {
  topic: string;
  genre: string;
  mood: string;
  purpose: string;
  vocalDelivery: string;
}): Record<string, string[]> {
  const t = params.topic;
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
    'Chorus 3 (Climax)': [
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

import OpenAI from 'openai';
import { Readable } from 'stream';

const openai = new OpenAI({ apiKey: process.env.API_KEY });

const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { text, voice } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  if (text.length > 500) {
    res.status(400).json({ error: 'Text must be 500 characters or fewer' });
    return;
  }

  const safeVoice = VALID_VOICES.includes(voice) ? voice : 'coral';

  try {
    const aiResponse = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: safeVoice,
      input: text,
      instructions: 'Speak in a cheerful and positive tone.',
      response_format: 'mp3',
      stream: true,
    });

    res.status(200);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');

    if (aiResponse.body) {
      Readable.fromWeb(aiResponse.body).pipe(res);
    } else {
      res.status(500).end();
    }
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).json({ error: 'Error generating speech' });
  }
}

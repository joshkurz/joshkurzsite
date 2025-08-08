import OpenAI from 'openai';
import { Readable } from 'stream';

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
});

export default async function handler(req, res) {
  const text = req.method === 'GET' ? req.query.text : req.body?.text;
  if (!text) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
      stream_format: 'audio',
      response_format: 'mp3',
    });

    const response = await speech.asResponse();
    res.setHeader('Content-Type', 'audio/mpeg');

    if (response.body) {
      const stream = Readable.fromWeb(response.body);
      stream.pipe(res);
    } else {
      res.status(500).end();
    }
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).json({ error: 'Error generating speech' });
  }
}


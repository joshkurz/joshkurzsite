import { generatePrompt } from '../../lib/generatePrompt.mjs';
import {
  createResponseWithFallback,
  getOpenAIClient,
  getRandomLocalJoke
} from '../../lib/openaiClient';

const openai = getOpenAIClient();

export default async function handler(req, res) {
  // Configure Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '3000', 10);

  try {
    const prompt = generatePrompt();
    let timeoutId = null;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });

    const jokePromise = createResponseWithFallback(
      openai,
      {
        input: prompt,
        temperature: 1.0,
        stream: true,
        reasoning: { effort: 'low' },
        text: { verbosity: 'low' }
      },
      { stream: true }
    );

    const jokeResponse = await Promise.race([jokePromise, timeoutPromise]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    for await (const chunk of jokeResponse) {
      const content = chunk.delta;
      if (content) {
        res.write(`data: ${content}\n\n`);
        if (res.flush) res.flush();
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.warn('[openai] Streaming joke failed, falling back to local file', {
      error: error?.message || String(error)
    });
    const joke = getRandomLocalJoke();
    res.write(`data: ${joke}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
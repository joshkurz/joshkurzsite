import { generatePrompt } from '../../lib/generatePrompt.mjs';
import { getOpenAIClient, getRandomLocalJoke } from '../../lib/openaiClient';

function writeSSE(res, payload) {
  const lines = String(payload).split(/\r?\n/);
  lines.forEach((line) => {
    res.write(`data: ${line}\n`);
  });
  res.write('\n');
  if (res.flush) res.flush();
}

const openai = getOpenAIClient();

export default async function handler(req, res) {
  // Configure Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '3000', 10);

  try {
    const prompt = generatePrompt();

    const jokePromise = openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      temperature: 1.0,
      stream: true,
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );

    const jokeResponse = await Promise.race([jokePromise, timeoutPromise]);

    for await (const chunk of jokeResponse) {
      const content = chunk.delta;
      if (content) {
        writeSSE(res, content);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const joke = getRandomLocalJoke();
    writeSSE(res, joke);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
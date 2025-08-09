import OpenAI from 'openai';
import jokes from '../../data/dadJokes.json';

const openai = process.env.API_KEY ? new OpenAI({ apiKey: process.env.API_KEY }) : null;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (!openai) throw new Error('Missing API key');

    const prompt = [
      'Pick a truly random, creative and unpredictable topic. This could be an unusual animal, a quirky situation, or an imaginary scenario – the more surprising the better.',
      'Use this unique topic to craft a witty, family-friendly dad joke.',
      'Return your response on two lines exactly in the following format:',
      'Question: <the setup>',
      'Answer: <the punchline>'
    ].join('\n');

    const jokeResponse = await openai.responses.create({
      model: 'gpt-4o',
      input: prompt,
      temperature: 1.0,
      stream: true
    });

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
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    const fallback = `Question: ${joke.question}\nAnswer: ${joke.answer}`;
    for (const char of fallback) {
      res.write(`data: ${char}\n\n`);
      if (res.flush) res.flush();
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

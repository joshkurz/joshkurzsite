import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { generatePrompt } from '../../lib/generatePrompt.mjs';

/*
 * When running locally without a valid API key (for example, during development
 * or in CI where the OpenAI API cannot be reached), we mock the minimal
 * portion of the OpenAI library used in this handler. The mock returns a
 * predictable topic and an asynchronous generator that yields a simple dad
 * joke character by character. To enable the mock, either set the
 * environment variable MOCK_OPENAI to "true" or omit API_KEY entirely.
 */
let openai;
if (process.env.MOCK_OPENAI === 'true' || !process.env.API_KEY) {
  // Read the list of dad jokes once so we can serve a random one when mocking
  const jokesPath = path.join(process.cwd(), 'data', 'dad_jokes.txt');
  const jokes = fs
    .readFileSync(jokesPath, 'utf-8')
    .split('\n\n')
    .filter(Boolean);

  // Define a mock responses API that mirrors the interface used below
  openai = {
    responses: {
      /**
       * Mock implementation of `responses.create`.
       * When called without streaming, returns a dummy value (not used in this implementation).
       * When called with streaming enabled, returns an async generator that yields a
       * dad joke character by character from the local jokes file.
       */
      async create({ stream }) {
        if (!stream) {
          // No streaming call should be made without stream in this implementation
          return { output_text: '' };
        }
        // Select a random joke from the dataset
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        async function* generator() {
          for (const char of joke) {
            // Wait a tiny bit between characters to better simulate streaming
            await new Promise((resolve) => setTimeout(resolve, 5));
            yield { delta: char };
          }
        }
        return generator();
      }
    }
  };
} else {
  openai = new OpenAI({
    apiKey: process.env.API_KEY
  });
}

const getRandomJoke = () => {
  const jokesPath = path.join(process.cwd(), 'data', 'dad_jokes.txt');
  const jokes = fs.readFileSync(jokesPath, 'utf-8').split('\n\n').filter(Boolean);
  return jokes[Math.floor(Math.random() * jokes.length)];
};

export default async function handler(req, res) {
  // Configure Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '3000', 10);

  try {
    const prompt = generatePrompt();

    const jokePromise = openai.responses.create({
      model: 'gpt-4o',
      input: prompt,
      temperature: 1.0,
      stream: true
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );

    const jokeResponse = await Promise.race([jokePromise, timeoutPromise]);

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
    const joke = getRandomJoke();
    res.write(`data: ${joke}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
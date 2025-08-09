import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

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

export default async function handler(req, res) {

    // Configure Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // Build a prompt asking for a dad joke about a random topic and instructing
        // the assistant to return it in a two-line format with "Question:" and "Answer:" prefixes.
        // Build a prompt asking the model to first choose a completely random and unexpected topic
        // and then craft a dad joke about it. We explicitly instruct the model to vary the
        // subject each time to encourage diversity. The joke should be returned on two lines
        // using the "Question:" and "Answer:" prefixes so the client can split them easily.
        // Construct a prompt that strongly encourages the model to pick a unique,
        // unpredictable topic on its own rather than echoing the user's input. We ask
        // for a family‑friendly dad joke about a random subject and instruct the
        // model to return the result using Question: and Answer: labels on separate
        // lines. By emphasising randomness and novelty in the topic we increase the
        // likelihood that the model varies its output each call.
        const prompt = [
          'Pick a truly random, creative and unpredictable topic. This could be an unusual animal, a quirky situation, or an imaginary scenario – the more surprising the better.',
          'Use this unique topic to craft a witty, family‑friendly dad joke.',
          'Return your response on two lines exactly in the following format:',
          'Question: <the setup>',
          'Answer: <the punchline>'
        ].join('\n');

        const jokeResponse = await openai.responses.create({
            model: "gpt-4o",
            input: prompt,
            // Increase the temperature slightly to encourage more randomness in the choice of topic
            temperature: 1.0,
            stream: true
        });

        // Stream the joke back to the client chunk by chunk without wrapping it in JSON.
        for await (const chunk of jokeResponse) {
            const content = chunk.delta;
            if (content) {
                res.write(`data: ${content}\n\n`);
                if (res.flush) res.flush();
            }
        }

        // Signal to the client that the stream is done
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        // In case of any error, send it down the SSE channel before closing
        const errorPayload = JSON.stringify({ type: 'error', message: error.message });
        res.write(`data: ${errorPayload}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    }
}
import OpenAI from 'openai';

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
  // Define a mock responses API that mirrors the interface used below
  openai = {
    responses: {
      /**
       * Mock implementation of `responses.create`.
       * When called without streaming, returns a dummy value (not used in this implementation).
       * When called with streaming enabled, returns an async generator that yields a
       * fixed dad joke in the same `Question:`/`Answer:` format character by character.
       */
      async create({ stream }) {
        if (!stream) {
          // No streaming call should be made without stream in this implementation
          return { output_text: '' };
        }
        // Provide a static dad joke formatted with Question and Answer on separate lines
        const joke = 'Question: Why did the pancake become a dad?\nAnswer: Because it had too much batter!';
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
        const prompt = `Tell me a witty and family-friendly dad joke about a random topic. ` +
          `Respond on two lines in the following format:\nQuestion: <your joke's question>\nAnswer: <the punchline>`;

        const jokeResponse = await openai.responses.create({
            model: "gpt-4o",
            input: prompt,
            temperature: 0.8,
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
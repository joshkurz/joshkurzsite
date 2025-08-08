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
       * When called without streaming, returns a static topic. When called
       * with streaming enabled, returns an async generator that yields a
       * fixed dad joke one character at a time to simulate streaming.
       */
      async create({ stream }) {
        if (!stream) {
          // Return a fixed topic when requesting a random topic
          return { output_text: 'pancakes' };
        }
        // Return an async iterator for the joke content
        const joke = 'Why did the pancake become a dad? Because it had too much batter!';
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
        // Get a random topic using OpenAI's responses endpoint
        const topicResponse = await openai.responses.create({
            model: "gpt-4o", // Use the latest model for responses
            input: "Give me a random topic in one word that is common in everyday life. Make them funny topics.",
            temperature: 0.7
        });
        const topic = topicResponse.output_text.trim();

        // Immediately send the topic back to the client as a question event
        const questionPayload = JSON.stringify({ type: 'question', text: topic });
        res.write(`data: ${questionPayload}\n\n`);
        if (res.flush) res.flush();

        // Generate a dad joke about the topic using responses endpoint
        const jokePrompt = `Tell me a clever and hilarious dad joke about "${topic}". Make it original, witty, and suitable for all ages. Keep it to one sentence.`;
        const jokeResponse = await openai.responses.create({
            model: "gpt-4o",
            input: jokePrompt,
            temperature: 0.8,
            stream: true
        });

        // Stream the joke back to the client chunk by chunk, labelling each as answer
        for await (const chunk of jokeResponse) {
            const content = chunk.delta;
            if (content) {
                const answerPayload = JSON.stringify({ type: 'answer', text: content });
                res.write(`data: ${answerPayload}\n\n`);
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
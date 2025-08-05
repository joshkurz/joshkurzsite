import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY
});

export default async function handler(req, res) {

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get a random topic using OpenAI's responses endpoint
    const topicResponse = await openai.responses.create({
        model: "gpt-4o", // Use the latest model for responses
        input: "Give me a random topic in one word that is common in everyday life. Make them funny topics.",
        temperature: 0.7
    });
    const topic = topicResponse.output_text.trim();

    // Generate a dad joke about the topic using responses endpoint
    const jokePrompt = `Tell me a clever and hilarious dad joke about "${topic}". Make it original, witty, and suitable for all ages. Keep it to one sentence.`;
    const jokeResponse = await openai.responses.create({
        model: "gpt-4o",
        input: jokePrompt,
        temperature: 0.8,
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
}
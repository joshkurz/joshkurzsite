import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY
});

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
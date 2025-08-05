import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY
});

export default async function handler(req, res) {

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let params1 = OpenAI.Chat.ChatCompletionCreateParams = {
        model: "gpt-4-turbo",
        messages: [{role: "user", content: "Give me a random topic in one word that is common in everyday life. Avoid science, technology, or anything unusual—just something people do or know about, like 'laundry', 'breakfast', or 'traffic'."}],
    };

    const completion1 = await openai.chat.completions.create(params1);
    const topic = completion1.choices[0].message.content;

    let jokeString = `Tell me a clever and hilarious dad joke about "${topic}". Make it original, witty, and suitable for all ages. Keep it to one sentence.`;
    let params2 = OpenAI.Chat.ChatCompletionCreateParams = {
        model: "gpt-4",
        messages: [{role: "user", content: jokeString}],
        stream: true
    };

    const stream = await openai.chat.completions.create(params2);

        for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            res.write(`data: ${content}\n\n`);
        }
    }

    res.write('data: [DONE]\n\n');
    res.end();
}
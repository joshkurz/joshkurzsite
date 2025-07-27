import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY
});

export default async function handler(req, res) {

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let params1 = OpenAI.Chat.ChatCompletionCreateParams = {
        model: "gpt-4",
        messages: [{role: "user", content: "Give me a random topic in one word"}],
    };

    const completion1 = await openai.chat.completions.create(params1);
    const topic = completion1.choices[0].message.content;

    let jokeString = "Write a random dad joke about " + topic + " that nobody has ever heard.";
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
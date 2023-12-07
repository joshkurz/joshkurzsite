import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY
});

export default async function handler(req, res) {
    let params1 = OpenAI.Chat.ChatCompletionCreateParams = {
        model: "gpt-4",
        messages: [{role: "user", content: "Give me a random topic in one word"}],
    };
    const completion1 = await openai.chat.completions.create(params1);
    console.log(completion1)
    let jokeString = "Write a random dad joke about " + completion1.choices[0].message.content + " that nobody has ever heard.";
    let params2 = OpenAI.Chat.ChatCompletionCreateParams = {
        model: "gpt-4",
        messages: [{role: "user", content: jokeString}],
    };
    const completion2 = await openai.chat.completions.create(params2);
    console.log(jokeString, completion2.choices[0].message.content);
    res.status(200).json({data: completion2.choices[0].message.content })
}
import { Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
    organization: process.env.ORG_KEY,
    apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
    let completion1 = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: "Give me a random topic in one word"}],
    });
    let jokeString = "Write a random dad joke about " + completion1.data.choices[0].message.content + " that nobody has ever heard.";
    let completion2 = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: jokeString}],
    });
    console.log(jokeString, completion2.data.choices[0].message.content);
    res.status(200).json({data: completion2.data.choices[0].message.content })
}
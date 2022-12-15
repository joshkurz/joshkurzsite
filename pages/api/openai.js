import { Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
    organization: process.env.ORG_KEY,
    apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
    let completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: "Write a dad joke about something random.",
        max_tokens: 2048,
        temperature: 0.9,
    });
    res.status(200).json({data: completion.data.choices[0].text })
}
import OpenAI, { toFile } from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.API_KEY
});

const speechFile = path.resolve(process.cwd(), 'speech.mp3');
console.log(speechFile)
async function main(data) {
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy',
    input: data.text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.writeFile(speechFile, buffer);

  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(buffer, 'speech.mp3'),
    model: 'whisper-1',
  });
  console.log(transcription.text);
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        console.log("text from user to tts: " + req.body)
        await main(req.body);
    }
    res.status(200).json({data: speechFile })
}
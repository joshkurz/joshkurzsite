import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { jokePrompt } from '../lib/jokePrompt.js';

const NUM_JOKES = 1000;
const outputPath = path.join(process.cwd(), 'data', 'dad_jokes.txt');

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fallback generator that loosely follows joke‑writing guidelines
function generateFallbackJoke() {
  const topics = ['aardvark', 'astronaut', 'toaster', 'penguin', 'cloud', 'robot', 'cactus', 'zebra', 'banana', 'violin', 'turtle', 'drone', 'unicorn', 'pizza', 'submarine'];
  const items = ['hat', 'scooter', 'trombone', 'slinky', 'teapot', 'balloon', 'helmet', 'backpack', 'pizza', 'harmonica', 'umbrella', 'cookie'];
  const actions = ['bring', 'juggle', 'balance', 'hide', 'wear'];
  const endings = [
    'because the invitation said to dress in layers.',
    'because it heard jokes are better when they come in threes.',
    'because it misunderstood the phrase "take something light."',
    'so it could always have a punchline up its sleeve.',
    "because that's how you get a setup, a callback, and a punchline."
  ];

  const topic = random(topics);
  const action = random(actions);
  let a = random(items);
  let b = random(items);
  let c = random(items);
  const uniq = new Set([a, b, c]);
  while (uniq.size < 3) {
    c = random(items);
    uniq.add(c);
  }
  [a, b, c] = Array.from(uniq);
  const setup = `Why did the ${topic} ${action} a ${a}, a ${b}, and a ${c}?`;
  const punchline = random(endings);
  return `Question: ${setup}\nAnswer: ${punchline}`;
}

async function main() {
  const jokes = [];
  let client;
  if (process.env.API_KEY) {
    client = new OpenAI({ apiKey: process.env.API_KEY });
  }
  for (let i = 0; i < NUM_JOKES; i++) {
    let joke;
    if (client) {
      try {
        const resp = await client.responses.create({ model: 'gpt-4o', input: jokePrompt });
        joke = resp.output_text.trim();
      } catch (err) {
        console.error('OpenAI request failed, falling back:', err.message);
        joke = generateFallbackJoke();
      }
    } else {
      joke = generateFallbackJoke();
    }
    jokes.push(joke);
    if ((i + 1) % 50 === 0) {
      console.log(`Generated ${i + 1} jokes`);
    }
  }
  fs.writeFileSync(outputPath, jokes.join('\n\n'));
  console.log(`Saved ${jokes.length} jokes to ${outputPath}`);
}

main();


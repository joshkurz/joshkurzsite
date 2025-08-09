import fs from 'fs';
import path from 'path';
import { generatePrompt } from '../lib/generatePrompt.mjs';

const count = parseInt(process.argv[2], 10) || 1000;
const outPath = path.join(process.cwd(), 'data', 'joke_prompts.txt');

const prompts = Array.from({ length: count }, () => generatePrompt());
fs.writeFileSync(outPath, prompts.join('\n\n'));
console.log(`Saved ${count} prompts to ${outPath}`);

import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const jokesPath = path.join(process.cwd(), 'data', 'dad_jokes.txt');
  const jokes = fs.readFileSync(jokesPath, 'utf-8').split('\n\n').filter(Boolean);
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  res.status(200).json({ joke });
}

import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    try {
        const filePath = path.join(process.cwd(), `speech.mp3`);
        console.log(filePath)
        const imageBuffer = fs.readFileSync(filePath);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(imageBuffer);
      } catch (e) {
        res.status(400).json({ error: true, message: 'Image not found' });
      }
}
  
import { getRandomTopJoke } from '../../lib/ratingsStorageDynamo.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const joke = await getRandomTopJoke();
    if (!joke) {
      return res.status(404).json({ error: 'No featured joke available' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(joke);
  } catch (error) {
    console.error('[featured-joke]', error);
    return res.status(500).json({ error: 'Unable to load featured joke' });
  }
}

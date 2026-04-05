import { readGlobalStats } from '../../lib/ratingsStorageDynamo.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const stats = await readGlobalStats();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[global-stats]', error);
    return res.status(200).json({ totalRatings: 0, overallAverage: 0 });
  }
}

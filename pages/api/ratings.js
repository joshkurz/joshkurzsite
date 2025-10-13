import {
  getMode,
  resolveDateKey,
  handleReadStats,
  handleWriteReview,
  validateRating
} from '../../lib/ratingsStorage'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { jokeId, date: requestedDate, mode: requestedMode } = req.query
    if (!jokeId || typeof jokeId !== 'string') {
      res.status(400).json({ error: 'Missing jokeId' })
      return
    }
    const mode = getMode(Array.isArray(requestedMode) ? requestedMode[0] : requestedMode)
    const dateKey = resolveDateKey(Array.isArray(requestedDate) ? requestedDate[0] : requestedDate)
    try {
      const stats = await handleReadStats({ mode, jokeId, dateKey })
      res.status(200).json(stats)
    } catch (error) {
      console.error('[ratings] Failed to load ratings', {
        jokeId,
        mode,
        dateKey,
        error
      })
      res.status(500).json({ error: 'Unable to load ratings' })
    }
    return
  }

  if (req.method === 'POST') {
    const {
      jokeId,
      rating,
      joke,
      author,
      date: requestedDate,
      mode: requestedMode
    } = req.body || {}
    if (!jokeId || typeof jokeId !== 'string') {
      res.status(400).json({ error: 'Missing jokeId' })
      return
    }
    const parsedRating = validateRating(rating)
    if (!parsedRating) {
      res.status(422).json({ error: 'Rating must be an integer between 1 and 5' })
      return
    }
    const mode = getMode(requestedMode)
    const dateKey = resolveDateKey(requestedDate)

    try {
      await handleWriteReview({ mode, jokeId, dateKey, rating: parsedRating, joke, author })
      const refreshedStats = await handleReadStats({ mode, jokeId, dateKey })
      res.status(200).json(refreshedStats)
    } catch (error) {
      console.error('[ratings] Failed to save rating', {
        jokeId,
        mode,
        dateKey,
        rating: parsedRating,
        hasJoke: Boolean(joke),
        error
      })
      res.status(500).json({ error: 'Unable to save rating' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end('Method Not Allowed')
}

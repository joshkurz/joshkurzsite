import {
  readStats,
  writeRating
} from '../../lib/ratingsStorageDynamo'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function getMode(value) {
  return value === 'daily' ? 'daily' : 'live'
}

function resolveDateKey(input) {
  if (typeof input === 'string' && DATE_REGEX.test(input)) return input
  return new Date().toISOString().slice(0, 10)
}

function validateRating(value) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null
  return rating
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { jokeId, date: requestedDate, mode: requestedMode } = req.query
    if (!jokeId || typeof jokeId !== 'string' || jokeId.length > 200) {
      res.status(400).json({ error: 'Invalid jokeId' })
      return
    }
    const mode = getMode(Array.isArray(requestedMode) ? requestedMode[0] : requestedMode)
    const dateKey = resolveDateKey(Array.isArray(requestedDate) ? requestedDate[0] : requestedDate)
    try {
      const stats = await readStats({ jokeId })
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
    if (!jokeId || typeof jokeId !== 'string' || jokeId.length > 200) {
      res.status(400).json({ error: 'Invalid jokeId' })
      return
    }
    const parsedRating = validateRating(rating)
    if (!parsedRating) {
      res.status(422).json({ error: 'Rating must be an integer between 1 and 5' })
      return
    }
    if (joke && (typeof joke !== 'string' || joke.length > 1000)) {
      res.status(400).json({ error: 'Joke text must be 1000 characters or fewer' })
      return
    }
    if (author && (typeof author !== 'string' || author.length > 200)) {
      res.status(400).json({ error: 'Author must be 200 characters or fewer' })
      return
    }
    const mode = getMode(requestedMode)
    const dateKey = resolveDateKey(requestedDate)

    try {
      await writeRating({ jokeId, rating: parsedRating, joke, author, mode, dateKey })
      const refreshedStats = await readStats({ jokeId })
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

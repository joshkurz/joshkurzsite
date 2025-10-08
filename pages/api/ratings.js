import { kv } from '@vercel/kv'

const KV_PREFIX = 'groan-ratings:'
const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const memoryStore = globalThis.__groanRatingsStore || new Map()
if (!globalThis.__groanRatingsStore) {
  globalThis.__groanRatingsStore = memoryStore
}

const kvConfigured = Boolean(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN &&
  process.env.KV_REST_API_READ_ONLY_TOKEN
)

function buildDefaultStats(overrides = {}) {
  return {
    counts: { ...DEFAULT_COUNTS },
    totalRatings: 0,
    average: 0,
    ...overrides
  }
}

async function readStats(jokeId) {
  const key = `${KV_PREFIX}${jokeId}`
  if (kvConfigured) {
    const stored = await kv.get(key)
    if (stored) {
      return normalizeStats(stored)
    }
    const initial = buildDefaultStats()
    await kv.set(key, initial)
    return initial
  }
  return memoryStore.get(key) || buildDefaultStats()
}

async function writeStats(jokeId, stats) {
  const key = `${KV_PREFIX}${jokeId}`
  if (kvConfigured) {
    await kv.set(key, stats)
    return
  }
  memoryStore.set(key, stats)
}

function normalizeStats(stats) {
  const counts = { ...DEFAULT_COUNTS, ...(stats?.counts || {}) }
  const totalRatings = Number(stats?.totalRatings || 0)
  const average = Number(stats?.average || 0)
  return { counts, totalRatings, average }
}

function validateRating(value) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null
  }
  return rating
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { jokeId } = req.query
    if (!jokeId || typeof jokeId !== 'string') {
      res.status(400).json({ error: 'Missing jokeId' })
      return
    }
    try {
      const stats = await readStats(jokeId)
      res.status(200).json(stats)
    } catch (error) {
      res.status(500).json({ error: 'Unable to load ratings' })
    }
    return
  }

  if (req.method === 'POST') {
    const { jokeId, rating, joke } = req.body || {}
    if (!jokeId || typeof jokeId !== 'string') {
      res.status(400).json({ error: 'Missing jokeId' })
      return
    }
    const parsedRating = validateRating(rating)
    if (!parsedRating) {
      res.status(422).json({ error: 'Rating must be an integer between 1 and 5' })
      return
    }

    try {
      const stats = await readStats(jokeId)
      const counts = { ...stats.counts }
      counts[parsedRating] = (counts[parsedRating] || 0) + 1
      const totalRatings = Object.values(counts).reduce((acc, val) => acc + val, 0)
      const totalScore = Object.entries(counts).reduce(
        (acc, [score, count]) => acc + Number(score) * count,
        0
      )
      const average = totalRatings === 0 ? 0 : Number((totalScore / totalRatings).toFixed(2))

      const updatedStats = {
        counts,
        totalRatings,
        average
      }
      if (joke && typeof joke === 'string') {
        updatedStats.joke = joke
      }

      await writeStats(jokeId, updatedStats)
      res.status(200).json(updatedStats)
    } catch (error) {
      res.status(500).json({ error: 'Unable to save rating' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end('Method Not Allowed')
}

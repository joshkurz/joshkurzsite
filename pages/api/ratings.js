import { BlobNotFoundError, head, put } from '@vercel/blob'

const BLOB_PREFIX = 'groan-ratings'
const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const memoryStore = globalThis.__groanRatingsStore || new Map()
if (!globalThis.__groanRatingsStore) {
  globalThis.__groanRatingsStore = memoryStore
}

const blobToken = process.env.DAD_READ_WRITE_TOKEN
const blobConfigured = Boolean(blobToken)

function buildDefaultStats(overrides = {}) {
  return {
    counts: { ...DEFAULT_COUNTS },
    totalRatings: 0,
    average: 0,
    ratings: [],
    ...overrides
  }
}

function normalizeStats(stats = {}) {
  const counts = { ...DEFAULT_COUNTS, ...(stats.counts || {}) }
  const totalRatings = Number(stats.totalRatings || 0)
  const average = Number(stats.average || 0)
  const ratings = Array.isArray(stats.ratings)
    ? stats.ratings.map((entry) => {
        const rating = Number(entry?.rating)
        if (!Number.isFinite(rating)) {
          return null
        }
        const normalized = {
          rating,
          submittedAt: entry?.submittedAt || entry?.timestamp || null
        }
        if (entry?.joke && typeof entry.joke === 'string') {
          normalized.joke = entry.joke
        }
        if (!normalized.submittedAt) {
          normalized.submittedAt = new Date().toISOString()
        }
        return normalized
      }).filter(Boolean)
    : []

  const normalizedStats = {
    ...stats,
    counts,
    totalRatings,
    average,
    ratings
  }
  if (normalizedStats.date) {
    normalizedStats.date = `${normalizedStats.date}`
  }
  if (normalizedStats.jokeId) {
    normalizedStats.jokeId = `${normalizedStats.jokeId}`
  }
  if (normalizedStats.joke && typeof normalizedStats.joke !== 'string') {
    delete normalizedStats.joke
  }
  return normalizedStats
}

function getDateKey(input) {
  if (typeof input === 'string' && DATE_REGEX.test(input)) {
    return input
  }
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function getStorageKey(dateKey, jokeId) {
  return `${dateKey}:${jokeId}`
}

function getBlobPath(dateKey, jokeId) {
  return `${BLOB_PREFIX}/${dateKey}/${jokeId}.json`
}

async function readStats(jokeId, dateKey) {
  if (blobConfigured) {
    const path = getBlobPath(dateKey, jokeId)
    try {
      const metadata = await head(path, { token: blobToken })
      const response = await fetch(metadata.downloadUrl)
      if (!response.ok) {
        throw new Error('Unable to download ratings data')
      }
      const payload = await response.json()
      const normalized = normalizeStats(payload)
      if (!normalized.date) {
        normalized.date = dateKey
      }
      if (!normalized.jokeId) {
        normalized.jokeId = jokeId
      }
      return normalized
    } catch (error) {
      if (error instanceof BlobNotFoundError || error?.name === 'BlobNotFoundError') {
        return buildDefaultStats({ date: dateKey, jokeId })
      }
      throw error
    }
  }
  const key = getStorageKey(dateKey, jokeId)
  return memoryStore.get(key) || buildDefaultStats({ date: dateKey, jokeId })
}

async function writeStats(jokeId, dateKey, stats) {
  const payload = normalizeStats({ ...stats, date: dateKey, jokeId, updatedAt: new Date().toISOString() })
  if (blobConfigured) {
    const path = getBlobPath(dateKey, jokeId)
    await put(path, JSON.stringify(payload), {
      access: 'public',
      contentType: 'application/json',
      cacheControl: 'no-store',
      token: blobToken
    })
    return payload
  }
  const key = getStorageKey(dateKey, jokeId)
  memoryStore.set(key, payload)
  return payload
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
    const { jokeId, date: requestedDate } = req.query
    if (!jokeId || typeof jokeId !== 'string') {
      res.status(400).json({ error: 'Missing jokeId' })
      return
    }
    const dateKey = getDateKey(Array.isArray(requestedDate) ? requestedDate[0] : requestedDate)
    try {
      const stats = await readStats(jokeId, dateKey)
      res.status(200).json(stats)
    } catch (error) {
      res.status(500).json({ error: 'Unable to load ratings' })
    }
    return
  }

  if (req.method === 'POST') {
    const { jokeId, rating, joke, date: requestedDate } = req.body || {}
    if (!jokeId || typeof jokeId !== 'string') {
      res.status(400).json({ error: 'Missing jokeId' })
      return
    }
    const parsedRating = validateRating(rating)
    if (!parsedRating) {
      res.status(422).json({ error: 'Rating must be an integer between 1 and 5' })
      return
    }
    const dateKey = getDateKey(requestedDate)

    try {
      const stats = await readStats(jokeId, dateKey)
      const counts = { ...stats.counts }
      counts[parsedRating] = (counts[parsedRating] || 0) + 1
      const totalRatings = Object.values(counts).reduce((acc, val) => acc + val, 0)
      const totalScore = Object.entries(counts).reduce(
        (acc, [score, count]) => acc + Number(score) * count,
        0
      )
      const average = totalRatings === 0 ? 0 : Number((totalScore / totalRatings).toFixed(2))
      const history = Array.isArray(stats.ratings) ? [...stats.ratings] : []
      const entry = { rating: parsedRating, submittedAt: new Date().toISOString() }
      if (joke && typeof joke === 'string') {
        entry.joke = joke
      }
      history.push(entry)

      const updatedStats = {
        counts,
        totalRatings,
        average,
        ratings: history,
        joke: typeof joke === 'string' ? joke : stats.joke,
        date: dateKey,
        jokeId
      }

      const persisted = await writeStats(jokeId, dateKey, updatedStats)
      res.status(200).json(persisted)
    } catch (error) {
      res.status(500).json({ error: 'Unable to save rating' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end('Method Not Allowed')
}

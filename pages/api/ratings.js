import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BASE_DIR = path.join(process.cwd(), 'data', 'ratings')

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error
    }
  }
}

function getMode(value) {
  return value === 'daily' ? 'daily' : 'live'
}

function buildDefaultStats(overrides = {}) {
  return {
    counts: { ...DEFAULT_COUNTS },
    totalRatings: 0,
    average: 0,
    ratings: [],
    ...overrides
  }
}

function normalizeEntry(entry = {}) {
  const rating = Number(entry.rating)
  if (!Number.isFinite(rating)) {
    return null
  }
  const normalized = {
    rating,
    submittedAt: entry.submittedAt || entry.timestamp || new Date().toISOString()
  }
  if (entry.joke && typeof entry.joke === 'string') {
    normalized.joke = entry.joke
  }
  if (entry.mode) {
    normalized.mode = entry.mode
  }
  if (entry.date) {
    normalized.date = entry.date
  }
  if (entry.jokeId) {
    normalized.jokeId = entry.jokeId
  }
  return normalized
}

function aggregateEntries(entries, { dateKey, jokeId, mode }) {
  if (!entries.length) {
    return buildDefaultStats({ date: dateKey, jokeId, mode })
  }
  const counts = { ...DEFAULT_COUNTS }
  const normalizedEntries = []
  for (const entry of entries) {
    const normalized = normalizeEntry(entry)
    if (!normalized) {
      continue
    }
    counts[normalized.rating] = (counts[normalized.rating] || 0) + 1
    normalizedEntries.push(normalized)
  }
  const totalRatings = normalizedEntries.length
  const totalScore = normalizedEntries.reduce(
    (acc, entry) => acc + entry.rating,
    0
  )
  const average = totalRatings === 0 ? 0 : Number((totalScore / totalRatings).toFixed(2))
  return {
    counts,
    totalRatings,
    average,
    ratings: normalizedEntries.sort((a, b) => {
      const aTime = new Date(a.submittedAt).getTime()
      const bTime = new Date(b.submittedAt).getTime()
      return aTime - bTime
    }),
    date: dateKey,
    jokeId,
    mode
  }
}

function getDateKey(input) {
  if (typeof input === 'string' && DATE_REGEX.test(input)) {
    return input
  }
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[ratings] Failed to read review file', { filePath, error })
    return null
  }
}

async function readEntriesFromDir(dirPath, filterFn) {
  let entries = []
  try {
    const files = await fs.readdir(dirPath)
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue
      }
      const filePath = path.join(dirPath, file)
      const payload = await readJson(filePath)
      if (!payload) {
        continue
      }
      if (!filterFn || filterFn(payload)) {
        entries.push(payload)
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('[ratings] Unable to list reviews directory', { dirPath, error })
    }
  }
  return entries
}

async function readStats({ mode, jokeId, dateKey }) {
  if (mode === 'daily') {
    const dirPath = path.join(BASE_DIR, 'daily', dateKey)
    const entries = await readEntriesFromDir(dirPath, (payload) => payload?.jokeId === jokeId)
    return aggregateEntries(entries, { dateKey, jokeId, mode })
  }
  const dirPath = path.join(BASE_DIR, 'live', jokeId)
  const entries = await readEntriesFromDir(dirPath)
  return aggregateEntries(entries, { dateKey, jokeId, mode })
}

async function writeReview({ mode, jokeId, dateKey, rating, joke }) {
  const submittedAt = new Date().toISOString()
  const payload = {
    jokeId,
    date: dateKey,
    rating,
    submittedAt,
    mode,
    ...(joke ? { joke } : {})
  }

  if (mode === 'daily') {
    const dirPath = path.join(BASE_DIR, 'daily', dateKey)
    await ensureDir(dirPath)
    const fileName = `${jokeId}-${submittedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`
    const filePath = path.join(dirPath, fileName)
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return
  }

  const dirPath = path.join(BASE_DIR, 'live', jokeId)
  await ensureDir(dirPath)
  const fileName = `${submittedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`
  const filePath = path.join(dirPath, fileName)
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
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
    const { jokeId, date: requestedDate, mode: requestedMode } = req.query
    if (!jokeId || typeof jokeId !== 'string') {
      res.status(400).json({ error: 'Missing jokeId' })
      return
    }
    const mode = getMode(Array.isArray(requestedMode) ? requestedMode[0] : requestedMode)
    const dateKey = getDateKey(Array.isArray(requestedDate) ? requestedDate[0] : requestedDate)
    try {
      const stats = await readStats({ mode, jokeId, dateKey })
      res.status(200).json(stats)
    } catch (error) {
      res.status(500).json({ error: 'Unable to load ratings' })
    }
    return
  }

  if (req.method === 'POST') {
    const { jokeId, rating, joke, date: requestedDate, mode: requestedMode } = req.body || {}
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
    const dateKey = getDateKey(requestedDate)

    try {
      await writeReview({ mode, jokeId, dateKey, rating: parsedRating, joke })
      const refreshedStats = await readStats({ mode, jokeId, dateKey })
      res.status(200).json(refreshedStats)
    } catch (error) {
      res.status(500).json({ error: 'Unable to save rating' })
    }
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end('Method Not Allowed')
}

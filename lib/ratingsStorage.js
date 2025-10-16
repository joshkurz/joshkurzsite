import { randomUUID } from 'node:crypto'
import { getObjectJson, listObjectKeys, putObjectJson, storageConfigured } from './s3Storage'

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const UNKNOWN_AUTHOR = 'Unknown'
const FATHERHOOD_AUTHOR = 'Fatherhood.gov'
const AI_AUTHOR = 'AI Generated'
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BLOB_PREFIX = 'groan-ratings'

function createMemoryStore() {
  return {
    daily: new Map(),
    live: new Map()
  }
}

const memoryStore = globalThis.__ratingsMemoryStore || createMemoryStore()
if (!globalThis.__ratingsMemoryStore) {
  globalThis.__ratingsMemoryStore = memoryStore
}

function getMode(value) {
  return value === 'daily' ? 'daily' : 'live'
}

function normalizeAuthor(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : UNKNOWN_AUTHOR
  }
  if (value && typeof value.toString === 'function') {
    const trimmed = value.toString().trim()
    return trimmed.length > 0 ? trimmed : UNKNOWN_AUTHOR
  }
  return UNKNOWN_AUTHOR
}

function normalizeAuthorLabel(author) {
  const normalized = normalizeAuthor(author)
  const lower = normalized.toLowerCase()
  if (lower === 'fatherhood.gov' || lower === 'fatherhood.com') {
    return FATHERHOOD_AUTHOR
  }
  if (lower === 'ai' || lower === 'ai generated') {
    return AI_AUTHOR
  }
  return normalized
}

function inferAuthor({ author, jokeId, mode }) {
  const canonical = normalizeAuthorLabel(author)
  if (canonical !== UNKNOWN_AUTHOR) {
    return canonical
  }

  const normalizedMode = mode === 'daily' ? 'daily' : mode === 'live' ? 'live' : null
  const normalizedJokeId = typeof jokeId === 'string' ? jokeId.toLowerCase() : ''

  if (normalizedMode === 'daily') {
    return FATHERHOOD_AUTHOR
  }

  if (normalizedJokeId.startsWith('fatherhood-') || normalizedJokeId.includes('fatherhood')) {
    return FATHERHOOD_AUTHOR
  }

  if (normalizedJokeId.startsWith('custom-')) {
    return AI_AUTHOR
  }

  return AI_AUTHOR
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

function normalizeEntry(entry = {}, { fallbackMode, fallbackJokeId, fallbackDate } = {}) {
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
  if (entry.mode || fallbackMode) {
    normalized.mode = entry.mode || fallbackMode
  }
  if (entry.date || fallbackDate) {
    normalized.date = entry.date || fallbackDate
  }
  if (entry.jokeId || fallbackJokeId) {
    normalized.jokeId = entry.jokeId || fallbackJokeId
  }
  const resolvedAuthor = inferAuthor({
    author: entry.author,
    jokeId: normalized.jokeId,
    mode: normalized.mode
  })
  if (resolvedAuthor && resolvedAuthor !== UNKNOWN_AUTHOR) {
    normalized.author = resolvedAuthor
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
    const normalized = normalizeEntry(entry, {
      fallbackMode: mode,
      fallbackJokeId: jokeId,
      fallbackDate: dateKey
    })
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

function getDailyBlobDirectory(dateKey, jokeId) {
  return `${BLOB_PREFIX}/daily/${dateKey}/${jokeId}`
}

function getLiveBlobDirectory(jokeId) {
  return `${BLOB_PREFIX}/live/${jokeId}`
}

function buildEntryFilename(submittedAt) {
  const safeTimestamp = submittedAt.replace(/[:.]/g, '-').replace(/Z$/, '')
  const uniqueSuffix = randomUUID()
  return `${safeTimestamp}-${uniqueSuffix}.json`
}

async function readBlobPayload(pathname) {
  return await getObjectJson(pathname)
}

function extractEntriesFromPayload(payload) {
  if (!payload) {
    return []
  }
  if (Array.isArray(payload)) {
    return payload
  }
  if (payload && Array.isArray(payload.entries)) {
    return payload.entries
  }
  if (payload && typeof payload === 'object') {
    return [payload]
  }
  return []
}

async function writeBlobEntry(pathname, entry) {
  await putObjectJson(pathname, entry, {
    cacheControl: 'no-store',
    contentType: 'application/json'
  })
}

async function listAllBlobs(prefix) {
  if (!storageConfigured) {
    return []
  }
  const keys = await listObjectKeys(prefix)
  return keys.map((key) => ({ pathname: key }))
}

function readMemoryEntries(mode, { dateKey, jokeId }) {
  if (mode === 'daily') {
    const dailyByDate = memoryStore.daily.get(dateKey)
    const entries = dailyByDate?.get(jokeId)
    return entries ? [...entries] : []
  }
  const entries = memoryStore.live.get(jokeId)
  return entries ? [...entries] : []
}

function writeMemoryEntries(mode, { dateKey, jokeId }, entries) {
  if (mode === 'daily') {
    if (!memoryStore.daily.has(dateKey)) {
      memoryStore.daily.set(dateKey, new Map())
    }
    const map = memoryStore.daily.get(dateKey)
    map.set(jokeId, [...entries])
    return
  }
  memoryStore.live.set(jokeId, [...entries])
}

async function readDirectoryEntries({ mode, jokeId, dateKey }) {
  const prefix =
    mode === 'daily' ? `${getDailyBlobDirectory(dateKey, jokeId)}/` : `${getLiveBlobDirectory(jokeId)}/`
  const blobs = await listAllBlobs(prefix)
  const entries = []
  for (const blob of blobs) {
    if (!blob?.pathname || !blob.pathname.endsWith('.json')) {
      continue
    }
    try {
      const payload = await readBlobPayload(blob.pathname)
      entries.push(...extractEntriesFromPayload(payload))
    } catch (error) {
      console.error('[ratings] Unable to read ratings blob entry', {
        pathname: blob.pathname,
        error
      })
    }
  }
  return entries
}

async function readEntries({ mode, jokeId, dateKey }) {
  if (storageConfigured) {
    return readDirectoryEntries({ mode, jokeId, dateKey })
  }
  return readMemoryEntries(mode, { dateKey, jokeId })
}

async function writeEntries({ mode, jokeId, dateKey, entries }) {
  if (storageConfigured) {
    const entry = entries[entries.length - 1]
    if (!entry) {
      return
    }
    const submittedAt = entry.submittedAt || new Date().toISOString()
    const directory =
      mode === 'daily' ? getDailyBlobDirectory(dateKey, jokeId) : getLiveBlobDirectory(jokeId)
    const filename = buildEntryFilename(submittedAt)
    const pathname = `${directory}/${filename}`
    await writeBlobEntry(pathname, entry)
    return
  }
  writeMemoryEntries(mode, { dateKey, jokeId }, entries)
}

async function readStats({ mode, jokeId, dateKey }) {
  const entries = await readEntries({ mode, jokeId, dateKey })
  return aggregateEntries(entries, { dateKey, jokeId, mode })
}

async function writeReview({ mode, jokeId, dateKey, rating, joke, author }) {
  const submittedAt = new Date().toISOString()
  const resolvedMode = mode === 'daily' ? 'daily' : 'live'
  const resolvedAuthor = inferAuthor({ author, jokeId, mode: resolvedMode })
  const payload = {
    jokeId,
    date: dateKey,
    rating,
    submittedAt,
    mode: resolvedMode,
    ...(joke ? { joke } : {}),
    ...(resolvedAuthor && resolvedAuthor !== UNKNOWN_AUTHOR ? { author: resolvedAuthor } : {})
  }
  if (storageConfigured) {
    await writeEntries({ mode: resolvedMode, jokeId, dateKey, entries: [payload] })
    return
  }

  const existingEntries = await readEntries({ mode: resolvedMode, jokeId, dateKey })
  const updatedEntries = [...existingEntries, payload]
  await writeEntries({ mode: resolvedMode, jokeId, dateKey, entries: updatedEntries })
}

async function* iterateAllRatingEntries() {
  if (storageConfigured) {
    const dailyBlobs = await listAllBlobs(`${BLOB_PREFIX}/daily/`)
    for (const blob of dailyBlobs) {
      if (!blob?.pathname || !blob.pathname.endsWith('.json')) {
        continue
      }
      const segments = blob.pathname.split('/')
      if (segments.length < 5) {
        continue
      }
      const dateKey = segments[2]
      const jokeId = segments[3]
      try {
        const payload = await readBlobPayload(blob.pathname)
        const entries = extractEntriesFromPayload(payload)
        for (const entry of entries) {
          const normalized = normalizeEntry(
            {
              ...entry,
              mode: 'daily',
              date: entry?.date || dateKey,
              jokeId: entry?.jokeId || jokeId
            },
            { fallbackMode: 'daily', fallbackDate: dateKey, fallbackJokeId: jokeId }
          )
          if (normalized) {
            normalized.mode = 'daily'
            if (!normalized.jokeId) {
              normalized.jokeId = jokeId
            }
            if (!normalized.date) {
              normalized.date = dateKey
            }
            yield normalized
          }
        }
      } catch (error) {
        console.error('[ratings] Unable to read daily ratings blob', {
          pathname: blob.pathname,
          error
        })
      }
    }

    const liveBlobs = await listAllBlobs(`${BLOB_PREFIX}/live/`)
    for (const blob of liveBlobs) {
      if (!blob?.pathname || !blob.pathname.endsWith('.json')) {
        continue
      }
      const segments = blob.pathname.split('/')
      if (segments.length < 4) {
        continue
      }
      const jokeId = segments[2]
      try {
        const payload = await readBlobPayload(blob.pathname)
        const entries = extractEntriesFromPayload(payload)
        for (const entry of entries) {
          const normalized = normalizeEntry(
            {
              ...entry,
              mode: 'live',
              jokeId: entry?.jokeId || jokeId
            },
            { fallbackMode: 'live', fallbackJokeId: jokeId }
          )
          if (normalized) {
            normalized.mode = 'live'
            if (!normalized.jokeId) {
              normalized.jokeId = jokeId
            }
            yield normalized
          }
        }
      } catch (error) {
        console.error('[ratings] Unable to read live ratings blob', {
          pathname: blob.pathname,
          error
        })
      }
    }

    return
  }

  for (const [dateKey, jokesMap] of memoryStore.daily.entries()) {
    for (const [jokeId, entries] of jokesMap.entries()) {
      for (const entry of entries) {
        const normalized = normalizeEntry(
          {
            ...entry,
            mode: 'daily',
            date: entry?.date || dateKey,
            jokeId: entry?.jokeId || jokeId
          },
          { fallbackMode: 'daily', fallbackDate: dateKey, fallbackJokeId: jokeId }
        )
        if (normalized) {
          normalized.mode = 'daily'
          if (!normalized.jokeId) {
            normalized.jokeId = jokeId
          }
          if (!normalized.date) {
            normalized.date = dateKey
          }
          yield normalized
        }
      }
    }
  }

  for (const [jokeId, entries] of memoryStore.live.entries()) {
    for (const entry of entries) {
      const normalized = normalizeEntry(
        {
          ...entry,
          mode: 'live',
          jokeId: entry?.jokeId || jokeId
        },
        { fallbackMode: 'live', fallbackJokeId: jokeId }
      )
      if (normalized) {
        normalized.mode = 'live'
        if (!normalized.jokeId) {
          normalized.jokeId = jokeId
        }
        yield normalized
      }
    }
  }
}

async function readAllRatingEntries() {
  const entries = []
  for await (const entry of iterateAllRatingEntries()) {
    entries.push(entry)
  }
  return entries
}

function cloneCounts(counts) {
  return { 1: counts[1] || 0, 2: counts[2] || 0, 3: counts[3] || 0, 4: counts[4] || 0, 5: counts[5] || 0 }
}

function safeAverage(totalScore, totalRatings) {
  if (!totalRatings) {
    return 0
  }
  return Number((totalScore / totalRatings).toFixed(2))
}

function insertRecentEntry(buffer, entry, maxSize = 20) {
  const timestamp = entry.submittedAt || entry.date || null
  const sortTime = Number(new Date(timestamp).getTime())
  const record = {
    entry,
    sortTime: Number.isFinite(sortTime) ? sortTime : 0
  }
  buffer.push(record)
  buffer.sort((a, b) => b.sortTime - a.sortTime)
  if (buffer.length > maxSize) {
    buffer.length = maxSize
  }
}

export async function summarizeRatings() {
  const baseResult = {
    totals: {
      overallRatings: 0,
      overallAverage: 0,
      uniqueJokes: 0,
      firstReviewAt: null,
      latestReviewAt: null,
      ratingCounts: { ...DEFAULT_COUNTS },
      byAuthor: []
    },
    ratingDistribution: {
      overall: { ...DEFAULT_COUNTS },
      byAuthor: {}
    },
    topPerformers: [],
    recentRatings: []
  }

  const overallCounts = { ...DEFAULT_COUNTS }
  const authorTotals = new Map()
  const performerStats = new Map()
  const uniqueJokes = new Set()
  let totalRatings = 0
  let totalScore = 0
  let earliestTimestamp = null
  let latestTimestamp = null
  const recentBuffer = []

  for await (const entry of iterateAllRatingEntries()) {
    const mode = entry.mode === 'daily' ? 'daily' : 'live'
    const rating = Number(entry.rating)
    if (!Number.isFinite(rating)) {
      continue
    }
    const submittedAt = entry.submittedAt || new Date().toISOString()
    const submittedTime = Number(new Date(submittedAt).getTime())
    if (!Number.isNaN(submittedTime)) {
      if (!earliestTimestamp || submittedTime < earliestTimestamp) {
        earliestTimestamp = submittedTime
      }
      if (!latestTimestamp || submittedTime > latestTimestamp) {
        latestTimestamp = submittedTime
      }
    }

    const dateKey = entry.date
      ? String(entry.date).slice(0, 10)
      : new Date(submittedAt).toISOString().slice(0, 10)

    const author = inferAuthor({ author: entry.author, jokeId: entry.jokeId, mode })

    totalRatings += 1
    totalScore += rating
    overallCounts[rating] = (overallCounts[rating] || 0) + 1

    if (!authorTotals.has(author)) {
      authorTotals.set(author, {
        counts: { ...DEFAULT_COUNTS },
        totalRatings: 0,
        totalScore: 0,
        lastRatedAt: null
      })
    }
    const authorStats = authorTotals.get(author)
    authorStats.totalRatings += 1
    authorStats.totalScore += rating
    authorStats.counts[rating] = (authorStats.counts[rating] || 0) + 1
    if (!authorStats.lastRatedAt || submittedTime > Number(new Date(authorStats.lastRatedAt || 0).getTime())) {
      authorStats.lastRatedAt = submittedAt
    }

    uniqueJokes.add(entry.jokeId || entry.joke || `${mode}:${dateKey}`)

    const performerKey = mode === 'daily' ? `daily:${dateKey}` : `live:${entry.jokeId || 'unknown'}`
    if (!performerStats.has(performerKey)) {
      performerStats.set(performerKey, {
        mode,
        jokeId: entry.jokeId || null,
        joke: entry.joke || null,
        date: mode === 'daily' ? dateKey : null,
        totalRatings: 0,
        totalScore: 0,
        lastRatedAt: null,
        author
      })
    }
    const stats = performerStats.get(performerKey)
    stats.totalRatings += 1
    stats.totalScore += rating
    if (mode === 'daily' && !stats.date) {
      stats.date = dateKey
    }
    if (!stats.joke && entry.joke) {
      stats.joke = entry.joke
    }
    if (!stats.jokeId && entry.jokeId) {
      stats.jokeId = entry.jokeId
    }
    if (!stats.author || stats.author === UNKNOWN_AUTHOR) {
      stats.author = author
    }
    if (!stats.lastRatedAt || submittedTime > Number(new Date(stats.lastRatedAt || 0).getTime())) {
      stats.lastRatedAt = submittedAt
    }

    insertRecentEntry(recentBuffer, {
      jokeId: entry.jokeId || null,
      mode,
      rating,
      joke: entry.joke || null,
      submittedAt,
      date: mode === 'daily' ? dateKey : entry.date || null,
      author
    })
  }

  if (totalRatings === 0) {
    return baseResult
  }

  const overallAverage = safeAverage(totalScore, totalRatings)

  const authorBreakdown = Array.from(authorTotals.entries())
    .map(([author, stats]) => ({
      author,
      totalRatings: stats.totalRatings,
      average: safeAverage(stats.totalScore, stats.totalRatings),
      lastRatedAt: stats.lastRatedAt,
      ratingCounts: cloneCounts(stats.counts)
    }))
    .sort((a, b) => {
      if (b.totalRatings === a.totalRatings) {
        if (b.average === a.average) {
          return a.author.localeCompare(b.author)
        }
        return b.average - a.average
      }
      return b.totalRatings - a.totalRatings
    })

  const ratingDistributionByAuthor = authorBreakdown.reduce((acc, item) => {
    acc[item.author] = cloneCounts(item.ratingCounts)
    return acc
  }, {})

  const topPerformers = Array.from(performerStats.values())
    .filter((stats) => stats.totalRatings >= 3)
    .map((stats) => ({
      mode: stats.mode,
      jokeId: stats.jokeId,
      joke: stats.joke,
      date: stats.date,
      totalRatings: stats.totalRatings,
      average: safeAverage(stats.totalScore, stats.totalRatings),
      lastRatedAt: stats.lastRatedAt,
      author: stats.author || null
    }))
    .sort((a, b) => {
      if (b.average === a.average) {
        if (b.totalRatings === a.totalRatings) {
          const aTime = new Date(a.lastRatedAt || 0).getTime()
          const bTime = new Date(b.lastRatedAt || 0).getTime()
          return bTime - aTime
        }
        return b.totalRatings - a.totalRatings
      }
      return b.average - a.average
    })
    .slice(0, 8)

  const recentRatings = recentBuffer.map((item) => item.entry)

  const result = {
    totals: {
      overallRatings: totalRatings,
      overallAverage,
      uniqueJokes: uniqueJokes.size,
      firstReviewAt: earliestTimestamp ? new Date(earliestTimestamp).toISOString() : null,
      latestReviewAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
      ratingCounts: cloneCounts(overallCounts),
      byAuthor: authorBreakdown.map(({ ratingCounts, ...rest }) => rest)
    },
    ratingDistribution: {
      overall: cloneCounts(overallCounts),
      byAuthor: ratingDistributionByAuthor
    },
    topPerformers,
    recentRatings
  }

  return result
}

function validateRating(value) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null
  }
  return rating
}

export async function handleReadStats({ mode, jokeId, dateKey }) {
  return readStats({ mode, jokeId, dateKey })
}

export async function handleWriteReview({ mode, jokeId, dateKey, rating, joke, author }) {
  return writeReview({ mode, jokeId, dateKey, rating, joke, author })
}

export function resolveDateKey(input) {
  return getDateKey(input)
}

export {
  DEFAULT_COUNTS,
  getMode,
  buildDefaultStats,
  aggregateEntries,
  normalizeEntry,
  readAllRatingEntries,
  validateRating
}

export { iterateAllRatingEntries }

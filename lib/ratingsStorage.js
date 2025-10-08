import { BlobNotFoundError, head, list, put } from '@vercel/blob'
import { randomUUID } from 'node:crypto'

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BLOB_PREFIX = 'groan-ratings'
const BLOB_TOKEN_ENV_VARS = [
  'DAD_READ_WRITE_TOKEN',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_STORE_READ_WRITE_TOKEN',
  'BLOB_RW_TOKEN',
  'BLOB_TOKEN',
  'VERCEL_BLOB_TOKEN'
]

const blobToken = BLOB_TOKEN_ENV_VARS.map((key) => process.env[key]).find(Boolean) || null
const blobConfigured = Boolean(blobToken)

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

if (!blobConfigured) {
  console.warn(
    `[ratings] Blob token missing; checked env vars: ${BLOB_TOKEN_ENV_VARS.join(', ')}`
  )
}

function withBlobToken(options = {}) {
  if (!blobToken) {
    return options
  }
  return { ...options, token: blobToken }
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
  try {
    const metadata = await head(pathname, withBlobToken())
    const response = await fetch(metadata.downloadUrl)
    if (!response.ok) {
      throw new Error('Unable to download ratings blob')
    }
    return await response.json()
  } catch (error) {
    if (error instanceof BlobNotFoundError || error?.name === 'BlobNotFoundError') {
      return null
    }
    throw error
  }
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
  const payload = JSON.stringify(entry, null, 2)
  const options = withBlobToken({
    access: 'public',
    contentType: 'application/json',
    cacheControl: 'no-store'
  })
  await put(pathname, payload, options)
}

async function listAllBlobs(prefix) {
  const blobs = []
  if (!blobConfigured) {
    return blobs
  }
  let cursor
  do {
    const options = withBlobToken({ prefix, cursor })
    const result = await list(options)
    if (Array.isArray(result.blobs)) {
      blobs.push(...result.blobs)
    }
    cursor = result.cursor || null
  } while (cursor)
  return blobs
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

async function readLegacyEntries({ mode, jokeId, dateKey }) {
  const legacyPath =
    mode === 'daily'
      ? `${BLOB_PREFIX}/daily/${dateKey}/${jokeId}.json`
      : `${BLOB_PREFIX}/live/${jokeId}.json`
  const payload = await readBlobPayload(legacyPath)
  return extractEntriesFromPayload(payload)
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
  if (blobConfigured) {
    const directoryEntries = await readDirectoryEntries({ mode, jokeId, dateKey })
    const legacyEntries = await readLegacyEntries({ mode, jokeId, dateKey })
    return [...directoryEntries, ...legacyEntries]
  }
  return readMemoryEntries(mode, { dateKey, jokeId })
}

async function writeEntries({ mode, jokeId, dateKey, entries }) {
  if (blobConfigured) {
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
  if (blobConfigured) {
    await writeEntries({ mode, jokeId, dateKey, entries: [payload] })
    return
  }

  const existingEntries = await readEntries({ mode, jokeId, dateKey })
  const updatedEntries = [...existingEntries, payload]
  await writeEntries({ mode, jokeId, dateKey, entries: updatedEntries })
}

async function readAllRatingEntries() {
  const allEntries = []
  if (blobConfigured) {
    const dailyBlobs = await listAllBlobs(`${BLOB_PREFIX}/daily/`)
    for (const blob of dailyBlobs) {
      if (!blob?.pathname || !blob.pathname.endsWith('.json')) {
        continue
      }
      const segments = blob.pathname.split('/')
      if (segments.length < 4) {
        continue
      }
      let dateKey
      let jokeId
      if (segments.length >= 5) {
        dateKey = segments[2]
        jokeId = segments[3]
      } else {
        dateKey = segments[segments.length - 2]
        const fileName = segments[segments.length - 1]
        jokeId = fileName.replace(/\.json$/i, '')
      }
      try {
        const payload = await readBlobPayload(blob.pathname)
        const entries = extractEntriesFromPayload(payload)
        for (const entry of entries) {
          const normalized = normalizeEntry({
            ...entry,
            mode: 'daily',
            date: entry?.date || dateKey,
            jokeId: entry?.jokeId || jokeId
          })
          if (normalized) {
            allEntries.push(normalized)
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
      if (segments.length < 3) {
        continue
      }
      let jokeId
      if (segments.length >= 4) {
        jokeId = segments[2]
      } else {
        const fileName = segments[segments.length - 1]
        jokeId = fileName.replace(/\.json$/i, '')
      }
      try {
        const payload = await readBlobPayload(blob.pathname)
        const entries = extractEntriesFromPayload(payload)
        for (const entry of entries) {
          const normalized = normalizeEntry({
            ...entry,
            mode: 'live',
            jokeId: entry?.jokeId || jokeId
          })
          if (normalized) {
            if (!normalized.jokeId) {
              normalized.jokeId = jokeId
            }
            allEntries.push(normalized)
          }
        }
      } catch (error) {
        console.error('[ratings] Unable to read live ratings blob', {
          pathname: blob.pathname,
          error
        })
      }
    }

    return allEntries
  }

  for (const [dateKey, jokesMap] of memoryStore.daily.entries()) {
    for (const [jokeId, entries] of jokesMap.entries()) {
      for (const entry of entries) {
        const normalized = normalizeEntry({
          ...entry,
          mode: 'daily',
          date: entry?.date || dateKey,
          jokeId: entry?.jokeId || jokeId
        })
        if (normalized) {
          allEntries.push(normalized)
        }
      }
    }
  }

  for (const [jokeId, entries] of memoryStore.live.entries()) {
    for (const entry of entries) {
      const normalized = normalizeEntry({
        ...entry,
        mode: 'live',
        jokeId: entry?.jokeId || jokeId
      })
      if (normalized) {
        if (!normalized.jokeId) {
          normalized.jokeId = jokeId
        }
        allEntries.push(normalized)
      }
    }
  }

  return allEntries
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

export async function summarizeRatings() {
  const entries = await readAllRatingEntries()
  const baseResult = {
    totals: {
      overallRatings: 0,
      overallAverage: 0,
      uniqueJokes: 0,
      firstReviewAt: null,
      latestReviewAt: null,
      ratingCounts: { ...DEFAULT_COUNTS },
      live: { totalRatings: 0, average: 0 },
      daily: { totalRatings: 0, average: 0 }
    },
    ratingDistribution: {
      overall: { ...DEFAULT_COUNTS },
      live: { ...DEFAULT_COUNTS },
      daily: { ...DEFAULT_COUNTS }
    },
    topLiveJokes: [],
    topDailyHighlights: [],
    highestVolumeDates: [],
    recentRatings: []
  }

  if (!entries.length) {
    return baseResult
  }

  const overallCounts = { ...DEFAULT_COUNTS }
  const modeTotals = {
    live: { counts: { ...DEFAULT_COUNTS }, totalRatings: 0, totalScore: 0 },
    daily: { counts: { ...DEFAULT_COUNTS }, totalRatings: 0, totalScore: 0 }
  }
  const jokesById = new Map()
  const ratingsByDate = new Map()
  const uniqueJokes = new Set()
  let totalRatings = 0
  let totalScore = 0
  let earliestTimestamp = null
  let latestTimestamp = null

  for (const entry of entries) {
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

    totalRatings += 1
    totalScore += rating
    overallCounts[rating] = (overallCounts[rating] || 0) + 1

    modeTotals[mode].totalRatings += 1
    modeTotals[mode].totalScore += rating
    modeTotals[mode].counts[rating] = (modeTotals[mode].counts[rating] || 0) + 1

    uniqueJokes.add(entry.jokeId || 'unknown')

    if (!jokesById.has(entry.jokeId)) {
      jokesById.set(entry.jokeId, { counts: { ...DEFAULT_COUNTS }, totalRatings: 0, totalScore: 0, joke: entry.joke || null })
    }
    const jokeStats = jokesById.get(entry.jokeId)
    jokeStats.counts[rating] = (jokeStats.counts[rating] || 0) + 1
    jokeStats.totalRatings += 1
    jokeStats.totalScore += rating
    if (entry.joke && !jokeStats.joke) {
      jokeStats.joke = entry.joke
    }

    if (!ratingsByDate.has(dateKey)) {
      ratingsByDate.set(dateKey, { counts: { ...DEFAULT_COUNTS }, totalRatings: 0, totalScore: 0 })
    }
    const dateStats = ratingsByDate.get(dateKey)
    dateStats.counts[rating] = (dateStats.counts[rating] || 0) + 1
    dateStats.totalRatings += 1
    dateStats.totalScore += rating
  }

  const overallAverage = safeAverage(totalScore, totalRatings)
  const liveAverage = safeAverage(modeTotals.live.totalScore, modeTotals.live.totalRatings)
  const dailyAverage = safeAverage(modeTotals.daily.totalScore, modeTotals.daily.totalRatings)

  const topLiveJokes = Array.from(jokesById.entries())
    .filter(([_, stats]) => stats.totalRatings >= 3)
    .map(([jokeId, stats]) => ({
      jokeId,
      average: safeAverage(stats.totalScore, stats.totalRatings),
      totalRatings: stats.totalRatings,
      counts: cloneCounts(stats.counts),
      joke: stats.joke || null
    }))
    .sort((a, b) => {
      if (b.average === a.average) {
        return b.totalRatings - a.totalRatings
      }
      return b.average - a.average
    })
    .slice(0, 10)

  const highestVolumeDates = Array.from(ratingsByDate.entries())
    .map(([date, stats]) => ({
      date,
      totalRatings: stats.totalRatings,
      average: safeAverage(stats.totalScore, stats.totalRatings),
      counts: cloneCounts(stats.counts)
    }))
    .sort((a, b) => {
      if (b.totalRatings === a.totalRatings) {
        return b.average - a.average
      }
      return b.totalRatings - a.totalRatings
    })
    .slice(0, 10)

  const recentRatings = entries
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.submittedAt || 0).getTime()
      const bTime = new Date(b.submittedAt || 0).getTime()
      return bTime - aTime
    })
    .slice(0, 20)

  const topDailyHighlights = topLiveJokes
    .filter((joke) => joke.counts[5] >= 3)
    .map((joke) => ({
      jokeId: joke.jokeId,
      totalRatings: joke.totalRatings,
      counts: cloneCounts(joke.counts),
      average: joke.average,
      joke: joke.joke
    }))

  const result = {
    totals: {
      overallRatings: totalRatings,
      overallAverage,
      uniqueJokes: uniqueJokes.size,
      firstReviewAt: earliestTimestamp ? new Date(earliestTimestamp).toISOString() : null,
      latestReviewAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
      ratingCounts: cloneCounts(overallCounts),
      live: {
        totalRatings: modeTotals.live.totalRatings,
        average: liveAverage,
        ratingCounts: cloneCounts(modeTotals.live.counts)
      },
      daily: {
        totalRatings: modeTotals.daily.totalRatings,
        average: dailyAverage,
        ratingCounts: cloneCounts(modeTotals.daily.counts)
      }
    },
    ratingDistribution: {
      overall: cloneCounts(overallCounts),
      live: cloneCounts(modeTotals.live.counts),
      daily: cloneCounts(modeTotals.daily.counts)
    },
    topLiveJokes,
    topDailyHighlights,
    highestVolumeDates,
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

export async function handleWriteReview({ mode, jokeId, dateKey, rating, joke }) {
  return writeReview({ mode, jokeId, dateKey, rating, joke })
}

export function resolveDateKey(input) {
  return getDateKey(input)
}

export { DEFAULT_COUNTS, getMode, buildDefaultStats, aggregateEntries, normalizeEntry, readAllRatingEntries, validateRating }

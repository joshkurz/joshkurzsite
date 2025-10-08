import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const USER_DEFINED_BASE_DIR = process.env.RATINGS_STORAGE_DIR
  ? path.resolve(process.env.RATINGS_STORAGE_DIR)
  : null
const DEFAULT_BASE_DIR = path.join(process.cwd(), 'data', 'ratings')
const FALLBACK_BASE_DIR = path.join(
  process.env.TMPDIR || '/tmp',
  'joshkurzsite',
  'ratings'
)

let resolvedBaseDir = null
let resolvingBaseDirPromise = null

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error
    }
  }
}

async function getBaseDir() {
  if (resolvedBaseDir) {
    return resolvedBaseDir
  }

  if (!resolvingBaseDirPromise) {
    const candidateDirs = [
      USER_DEFINED_BASE_DIR,
      DEFAULT_BASE_DIR,
      FALLBACK_BASE_DIR
    ].filter(Boolean)

    resolvingBaseDirPromise = (async () => {
      for (const candidate of candidateDirs) {
        try {
          await ensureDir(candidate)
          if (candidate !== DEFAULT_BASE_DIR) {
            console.info('[ratings] Using alternate storage directory', {
              dirPath: candidate
            })
          }
          resolvedBaseDir = candidate
          return candidate
        } catch (error) {
          console.warn('[ratings] Unable to use storage directory', {
            dirPath: candidate,
            error
          })
        }
      }

      throw new Error('Unable to locate a writable directory for ratings storage')
    })()
  }

  try {
    return await resolvingBaseDirPromise
  } finally {
    resolvingBaseDirPromise = null
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
  const baseDir = await getBaseDir()
  if (mode === 'daily') {
    const dirPath = path.join(baseDir, 'daily', dateKey)
    const entries = await readEntriesFromDir(dirPath, (payload) => payload?.jokeId === jokeId)
    return aggregateEntries(entries, { dateKey, jokeId, mode })
  }
  const dirPath = path.join(baseDir, 'live', jokeId)
  const entries = await readEntriesFromDir(dirPath)
  return aggregateEntries(entries, { dateKey, jokeId, mode })
}

async function writeReview({ mode, jokeId, dateKey, rating, joke }) {
  const baseDir = await getBaseDir()
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
    const dirPath = path.join(baseDir, 'daily', dateKey)
    await ensureDir(dirPath)
    const fileName = `${jokeId}-${submittedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`
    const filePath = path.join(dirPath, fileName)
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return
  }

  const dirPath = path.join(baseDir, 'live', jokeId)
  await ensureDir(dirPath)
  const fileName = `${submittedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`
  const filePath = path.join(dirPath, fileName)
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
}

async function readAllRatingEntries() {
  const baseDir = await getBaseDir()
  const allEntries = []

  const dailyRoot = path.join(baseDir, 'daily')
  try {
    const dateDirs = await fs.readdir(dailyRoot, { withFileTypes: true })
    for (const dirent of dateDirs) {
      if (!dirent.isDirectory()) {
        continue
      }
      const dateKey = dirent.name
      const dirPath = path.join(dailyRoot, dateKey)
      const payloads = await readEntriesFromDir(dirPath)
      for (const payload of payloads) {
        const normalized = normalizeEntry({
          ...payload,
          mode: 'daily',
          date: payload?.date || dateKey
        })
        if (normalized) {
          if (!normalized.date) {
            normalized.date = dateKey
          }
          normalized.mode = 'daily'
          allEntries.push(normalized)
        }
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('[ratings] Unable to read daily ratings directories', {
        root: dailyRoot,
        error
      })
    }
  }

  const liveRoot = path.join(baseDir, 'live')
  try {
    const jokeDirs = await fs.readdir(liveRoot, { withFileTypes: true })
    for (const dirent of jokeDirs) {
      if (!dirent.isDirectory()) {
        continue
      }
      const jokeId = dirent.name
      const dirPath = path.join(liveRoot, jokeId)
      const payloads = await readEntriesFromDir(dirPath)
      for (const payload of payloads) {
        const normalized = normalizeEntry({
          ...payload,
          mode: 'live',
          jokeId
        })
        if (normalized) {
          normalized.mode = 'live'
          if (!normalized.jokeId) {
            normalized.jokeId = jokeId
          }
          allEntries.push(normalized)
        }
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('[ratings] Unable to read live ratings directories', {
        root: liveRoot,
        error
      })
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

    const jokeId = entry.jokeId || 'unknown'
    const jokeKey = `${mode}::${jokeId}`
    uniqueJokes.add(jokeKey)
    const existing = jokesById.get(jokeKey) || {
      jokeId,
      mode,
      joke: entry.joke || null,
      totalRatings: 0,
      totalScore: 0,
      counts: { ...DEFAULT_COUNTS },
      firstRatedAt: submittedAt,
      lastRatedAt: submittedAt,
      dates: new Map()
    }
    existing.totalRatings += 1
    existing.totalScore += rating
    existing.counts[rating] = (existing.counts[rating] || 0) + 1
    if (entry.joke && !existing.joke) {
      existing.joke = entry.joke
    }
    if (Number(new Date(submittedAt).getTime()) < Number(new Date(existing.firstRatedAt).getTime())) {
      existing.firstRatedAt = submittedAt
    }
    if (Number(new Date(submittedAt).getTime()) > Number(new Date(existing.lastRatedAt).getTime())) {
      existing.lastRatedAt = submittedAt
    }
    if (dateKey) {
      const dateValue = existing.dates.get(dateKey) || { count: 0, totalScore: 0 }
      dateValue.count += 1
      dateValue.totalScore += rating
      existing.dates.set(dateKey, dateValue)
    }
    jokesById.set(jokeKey, existing)

    if (dateKey) {
      const existingDate = ratingsByDate.get(dateKey) || {
        date: dateKey,
        totalRatings: 0,
        totalScore: 0,
        counts: { ...DEFAULT_COUNTS },
        modeBreakdown: { live: 0, daily: 0 }
      }
      existingDate.totalRatings += 1
      existingDate.totalScore += rating
      existingDate.counts[rating] = (existingDate.counts[rating] || 0) + 1
      existingDate.modeBreakdown[mode] = (existingDate.modeBreakdown[mode] || 0) + 1
      ratingsByDate.set(dateKey, existingDate)
    }
  }

  const overallAverage = safeAverage(totalScore, totalRatings)
  const liveAverage = safeAverage(modeTotals.live.totalScore, modeTotals.live.totalRatings)
  const dailyAverage = safeAverage(modeTotals.daily.totalScore, modeTotals.daily.totalRatings)

  const topLiveJokes = Array.from(jokesById.values())
    .filter((item) => item.mode === 'live')
    .map((item) => ({
      jokeId: item.jokeId,
      mode: item.mode,
      joke: item.joke,
      totalRatings: item.totalRatings,
      average: safeAverage(item.totalScore, item.totalRatings),
      counts: cloneCounts(item.counts),
      firstRatedAt: item.firstRatedAt,
      lastRatedAt: item.lastRatedAt
    }))
    .sort((a, b) => {
      if (b.average === a.average) {
        return b.totalRatings - a.totalRatings
      }
      return b.average - a.average
    })
    .slice(0, 5)

  const topDailyHighlights = Array.from(ratingsByDate.values())
    .filter((item) => item.modeBreakdown.daily > 0)
    .map((item) => ({
      date: item.date,
      totalRatings: item.totalRatings,
      average: safeAverage(item.totalScore, item.totalRatings),
      dailyRatings: item.modeBreakdown.daily
    }))
    .sort((a, b) => {
      if (b.average === a.average) {
        return b.totalRatings - a.totalRatings
      }
      return b.average - a.average
    })
    .slice(0, 5)

  const highestVolumeDates = Array.from(ratingsByDate.values())
    .sort((a, b) => b.totalRatings - a.totalRatings)
    .slice(0, 7)
    .map((item) => ({
      date: item.date,
      totalRatings: item.totalRatings,
      liveRatings: item.modeBreakdown.live,
      dailyRatings: item.modeBreakdown.daily,
      average: safeAverage(item.totalScore, item.totalRatings)
    }))

  const recentRatings = entries
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.submittedAt || 0).getTime()
      const bTime = new Date(b.submittedAt || 0).getTime()
      return bTime - aTime
    })
    .slice(0, 12)
    .map((entry) => ({
      jokeId: entry.jokeId || 'unknown',
      mode: entry.mode === 'daily' ? 'daily' : 'live',
      rating: entry.rating,
      joke: entry.joke || null,
      submittedAt: entry.submittedAt,
      date: entry.date || null
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

export { DEFAULT_COUNTS, getMode, buildDefaultStats, aggregateEntries, normalizeEntry, readEntriesFromDir, readAllRatingEntries, validateRating, getBaseDir }

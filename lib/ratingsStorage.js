import { generateId, query } from './db'

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const UNKNOWN_AUTHOR = 'Unknown'
const FATHERHOOD_AUTHOR = 'Fatherhood.gov'
const AI_AUTHOR = 'AI Generated'
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function getMode(value) {
  return value === 'daily' ? 'daily' : 'live'
}

function normalizeAuthor(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) {
      return trimmed
    }
  } else if (value && typeof value.toString === 'function') {
    const converted = value.toString().trim()
    if (converted) {
      return converted
    }
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
  if (lower === 'unknown') {
    return UNKNOWN_AUTHOR
  }
  return normalized
}

function inferAuthor({ author, jokeId, mode }) {
  const canonical = normalizeAuthorLabel(author)
  if (canonical !== UNKNOWN_AUTHOR) {
    return canonical
  }
  const normalizedMode = mode === 'daily' ? 'daily' : 'live'
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

function buildCounts(row = {}) {
  return {
    1: Number(row.count_1 || 0),
    2: Number(row.count_2 || 0),
    3: Number(row.count_3 || 0),
    4: Number(row.count_4 || 0),
    5: Number(row.count_5 || 0)
  }
}

function getDateKey(input) {
  if (typeof input === 'string' && DATE_REGEX.test(input)) {
    return input
  }
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function normalizeAverage(value) {
  if (value === null || value === undefined) {
    return 0
  }
  return Number(Number(value).toFixed(2))
}

export function resolveDateKey(input) {
  return getDateKey(input)
}

export function validateRating(value) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null
  }
  return rating
}

function mapRatingRow(row) {
  return {
    rating: Number(row.rating),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    mode: row.mode,
    jokeId: row.joke_id,
    joke: row.joke,
    author: row.author,
    date: row.date_key ? new Date(row.date_key).toISOString().slice(0, 10) : null
  }
}

export async function handleWriteReview({ mode, jokeId, dateKey, rating, joke, author }) {
  const resolvedMode = getMode(mode)
  const submittedAt = new Date().toISOString()
  const effectiveDate = resolvedMode === 'daily' ? getDateKey(dateKey) : null
  const normalizedAuthor = inferAuthor({ author, jokeId, mode: resolvedMode })

  await query(
    `INSERT INTO ratings (id, joke_id, rating, mode, date_key, joke, author, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      generateId('rating'),
      jokeId,
      rating,
      resolvedMode,
      effectiveDate,
      joke || null,
      normalizedAuthor,
      submittedAt
    ]
  )
}

export async function handleReadStats({ mode, jokeId, dateKey }) {
  const resolvedMode = getMode(mode)
  const effectiveDate = resolvedMode === 'daily' ? getDateKey(dateKey) : null
  const conditions = ['joke_id = $1', 'mode = $2']
  const params = [jokeId, resolvedMode]
  if (resolvedMode === 'daily') {
    conditions.push('date_key = $3')
    params.push(effectiveDate)
  }
  const whereClause = conditions.join(' AND ')

  const aggregateQuery = await query(
    `SELECT
       COUNT(*)::int AS total_ratings,
       AVG(rating) AS average,
       SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS count_1,
       SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS count_2,
       SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS count_3,
       SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS count_4,
       SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS count_5
     FROM ratings
     WHERE ${whereClause}`,
    params
  )

  const aggregateRow = aggregateQuery.rows[0] || {}
  const totalRatings = Number(aggregateRow.total_ratings || 0)
  const counts = buildCounts(aggregateRow)
  const average = totalRatings === 0 ? 0 : normalizeAverage(aggregateRow.average)

  const result = {
    counts,
    totalRatings,
    average,
    jokeId,
    mode: resolvedMode,
    date: effectiveDate,
    ratings: []
  }

  if (totalRatings > 0) {
    const entries = await query(
      `SELECT rating, submitted_at, mode, joke_id, joke, author, date_key
         FROM ratings
        WHERE ${whereClause}
        ORDER BY submitted_at ASC
        LIMIT 200`,
      params
    )
    result.ratings = entries.rows.map(mapRatingRow)
  }

  return result
}

function cloneCounts(counts) {
  return { 1: counts[1] || 0, 2: counts[2] || 0, 3: counts[3] || 0, 4: counts[4] || 0, 5: counts[5] || 0 }
}

export async function summarizeRatings() {
  const base = {
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

  const overallResult = await query(`
    SELECT
      COUNT(*)::int AS total_ratings,
      AVG(rating) AS average,
      MIN(submitted_at) AS first_review,
      MAX(submitted_at) AS latest_review,
      COUNT(
        DISTINCT CASE
          WHEN joke_id IS NULL OR joke_id = '' THEN CONCAT(
            mode,
            ':',
            CASE
              WHEN date_key IS NULL THEN 'unknown'
              ELSE TO_CHAR(date_key, 'YYYY-MM-DD')
            END
          )
          ELSE joke_id
        END
      ) AS unique_jokes,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS count_1,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS count_2,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS count_3,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS count_4,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS count_5
    FROM ratings
  `)

  const overallRow = overallResult.rows[0]
  if (!overallRow || Number(overallRow.total_ratings || 0) === 0) {
    return base
  }

  const totals = Number(overallRow.total_ratings)
  base.totals.overallRatings = totals
  base.totals.overallAverage = normalizeAverage(overallRow.average)
  base.totals.uniqueJokes = Number(overallRow.unique_jokes || 0)
  base.totals.firstReviewAt = overallRow.first_review
    ? new Date(overallRow.first_review).toISOString()
    : null
  base.totals.latestReviewAt = overallRow.latest_review
    ? new Date(overallRow.latest_review).toISOString()
    : null
  const overallCounts = buildCounts(overallRow)
  base.totals.ratingCounts = cloneCounts(overallCounts)
  base.ratingDistribution.overall = cloneCounts(overallCounts)

  const authorResult = await query(`
    SELECT
      author,
      COUNT(*)::int AS total_ratings,
      AVG(rating) AS average,
      MAX(submitted_at) AS last_rated_at,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS count_1,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS count_2,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS count_3,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS count_4,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS count_5
    FROM ratings
    GROUP BY author
  `)

  const authorRows = authorResult.rows
    .map((row) => ({
      author: row.author || UNKNOWN_AUTHOR,
      totalRatings: Number(row.total_ratings || 0),
      average: normalizeAverage(row.average),
      lastRatedAt: row.last_rated_at ? new Date(row.last_rated_at).toISOString() : null,
      counts: buildCounts(row)
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

  base.totals.byAuthor = authorRows.map(({ counts, ...rest }) => rest)
  base.ratingDistribution.byAuthor = authorRows.reduce((acc, row) => {
    acc[row.author] = cloneCounts(row.counts)
    return acc
  }, {})

  const performersResult = await query(`
    WITH aggregated AS (
      SELECT
        mode,
        joke_id,
        date_key,
        MAX(joke) AS joke,
        MAX(author) AS author,
        COUNT(*)::int AS total_ratings,
        AVG(rating) AS average,
        MAX(submitted_at) AS last_rated_at
      FROM ratings
      GROUP BY mode, joke_id, date_key
    )
    SELECT
      mode,
      joke_id,
      date_key,
      joke,
      author,
      total_ratings,
      average,
      last_rated_at
    FROM aggregated
    WHERE total_ratings >= 3
    ORDER BY average DESC, total_ratings DESC, last_rated_at DESC
    LIMIT 8
  `)

  base.topPerformers = performersResult.rows.map((row) => ({
    mode: row.mode,
    jokeId: row.joke_id,
    joke: row.joke,
    date: row.date_key ? new Date(row.date_key).toISOString().slice(0, 10) : null,
    totalRatings: Number(row.total_ratings || 0),
    average: normalizeAverage(row.average),
    lastRatedAt: row.last_rated_at ? new Date(row.last_rated_at).toISOString() : null,
    author: row.author || null
  }))

  const recentResult = await query(`
    SELECT rating, submitted_at, mode, joke_id, joke, author, date_key
      FROM ratings
     ORDER BY submitted_at DESC
     LIMIT 20
  `)

  base.recentRatings = recentResult.rows.map((row) => ({
    rating: Number(row.rating),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    mode: row.mode,
    jokeId: row.joke_id,
    joke: row.joke,
    author: row.author,
    date: row.date_key ? new Date(row.date_key).toISOString().slice(0, 10) : null
  }))

  return base
}

export async function readRecentRatingEntries(limit = 500) {
  const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 500
  const result = await query(
    `SELECT rating, submitted_at, mode, joke_id, joke, author, date_key
       FROM ratings
      ORDER BY submitted_at DESC
      LIMIT $1`,
    [effectiveLimit]
  )
  return result.rows.map(mapRatingRow)
}

export { DEFAULT_COUNTS, getMode }

import { randomUUID } from 'node:crypto'
import { query } from './db'
import { resolveDashboardSummaryTtlMs } from './dashboardSummary'

const DEFAULT_AUTHOR = 'Anonymous'
const ACCEPTED_STATUS = 'accepted'
const REJECTED_STATUS = 'rejected'

function normalizeAuthor(value) {
  if (!value) {
    return DEFAULT_AUTHOR
  }
  return String(value).trim() || DEFAULT_AUTHOR
}

function normalizeOpener(value) {
  return String(value || '').trim()
}

function normalizeResponse(value) {
  const response = String(value || '').trim()
  return response || null
}

function createJokeText(opener, response) {
  return response ? `Question: ${opener}\nAnswer: ${response}` : `Question: ${opener}`
}

function mapRowToJoke(row) {
  return {
    id: row.id,
    opener: row.opener,
    response: row.response,
    text: row.text,
    author: row.author,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  }
}

async function insertSubmission({ id, jokeId, opener, response, author, status, reason }) {
  const createdAt = new Date().toISOString()
  await query(
    `INSERT INTO joke_submissions (id, joke_id, opener, response, author, status, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, jokeId, opener, response, author, status, reason || null, createdAt]
  )
}

export async function recordAcceptedJoke({ opener, response, author }) {
  const normalizedOpener = normalizeOpener(opener)
  const normalizedResponse = normalizeResponse(response)
  const normalizedAuthor = normalizeAuthor(author)

  if (!normalizedOpener) {
    throw new Error('Setup is required')
  }

  const jokeId = `custom-${randomUUID()}`
  const submissionId = `submission-${randomUUID()}`
  const text = createJokeText(normalizedOpener, normalizedResponse)
  const createdAt = new Date().toISOString()

  await query(
    `INSERT INTO jokes (id, source_id, opener, response, text, author, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET opener = EXCLUDED.opener, response = EXCLUDED.response, text = EXCLUDED.text, author = EXCLUDED.author`,
    [
      jokeId,
      null,
      normalizedOpener,
      normalizedResponse,
      text,
      normalizedAuthor,
      'custom',
      createdAt
    ]
  )

  await insertSubmission({
    id: submissionId,
    jokeId,
    opener: normalizedOpener,
    response: normalizedResponse,
    author: normalizedAuthor,
    status: ACCEPTED_STATUS
  })

  return {
    id: jokeId,
    opener: normalizedOpener,
    response: normalizedResponse,
    text,
    author: normalizedAuthor,
    createdAt
  }
}

export async function recordRejectedJoke({ opener, response, author, reason }) {
  const normalizedOpener = normalizeOpener(opener)
  const normalizedResponse = normalizeResponse(response)
  const normalizedAuthor = normalizeAuthor(author)
  const submissionId = `submission-${randomUUID()}`

  await insertSubmission({
    id: submissionId,
    jokeId: null,
    opener: normalizedOpener,
    response: normalizedResponse,
    author: normalizedAuthor,
    status: REJECTED_STATUS,
    reason: reason || 'Rejected'
  })

  return {
    id: submissionId,
    opener: normalizedOpener,
    response: normalizedResponse,
    author: normalizedAuthor,
    reason: reason || 'Rejected'
  }
}

export async function getCustomJokes({ limit } = {}) {
  const clause = Number.isInteger(limit) && limit > 0 ? 'LIMIT $1' : ''
  const params = []
  if (clause) {
    params.push(limit)
  }
  const result = await query(
    `SELECT id, opener, response, text, author, created_at
       FROM jokes
      WHERE source = 'custom'
      ORDER BY created_at DESC ${clause}`,
    params
  )
  return result.rows.map(mapRowToJoke)
}

export async function clearCustomJokesCache() {
  // cache no longer required; function kept for backwards compatibility
}

export function resolveCustomJokesTtlMs(ttlMs) {
  return resolveDashboardSummaryTtlMs(ttlMs)
}

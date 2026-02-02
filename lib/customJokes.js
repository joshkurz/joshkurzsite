import { randomUUID } from 'node:crypto'
import { getDynamoClient, RATINGS_TABLE, PutCommand, QueryCommand } from './dynamoClient.js'

const DEFAULT_AUTHOR = 'Anonymous'

const globalState = globalThis.__customJokesState || {
  jokes: [],
  generatedAt: null,
  initializing: null
}

if (!globalThis.__customJokesState) {
  globalThis.__customJokesState = globalState
}

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

function createJokePayload({ id, opener, response, author, createdAt }) {
  const normalizedOpener = normalizeOpener(opener)
  const normalizedResponse = normalizeResponse(response)
  const normalizedAuthor = normalizeAuthor(author)
  const text = normalizedResponse
    ? `Question: ${normalizedOpener}\nAnswer: ${normalizedResponse}`
    : `Question: ${normalizedOpener}`
  return {
    id,
    opener: normalizedOpener,
    response: normalizedResponse,
    text,
    author: normalizedAuthor,
    createdAt: createdAt || new Date().toISOString()
  }
}

function normalizeStoredJoke(item) {
  if (!item || typeof item !== 'object') {
    return null
  }
  const id = item.id || item.PK?.replace('CUSTOM_JOKE#', '')
  const opener = normalizeOpener(item.opener)
  if (!opener) {
    return null
  }
  const response = normalizeResponse(item.response)
  const author = normalizeAuthor(item.author)
  const text = item.text
    ? String(item.text)
    : response
      ? `Question: ${opener}\nAnswer: ${response}`
      : `Question: ${opener}`
  return {
    id: id || `custom-${randomUUID()}`,
    opener,
    response,
    text,
    author
  }
}

async function loadAcceptedFromDynamo() {
  const client = getDynamoClient()
  const jokes = []

  const result = await client.send(new QueryCommand({
    TableName: RATINGS_TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'CUSTOM_JOKES_ACCEPTED'
    },
    ScanIndexForward: false // Most recent first
  }))

  for (const item of result.Items || []) {
    const normalized = normalizeStoredJoke(item)
    if (normalized) {
      jokes.push(normalized)
    }
  }

  return jokes
}

async function refreshAcceptedJokes() {
  if (globalState.refreshPromise) {
    return globalState.refreshPromise
  }
  const promise = (async () => {
    const jokes = await loadAcceptedFromDynamo()
    globalState.jokes = jokes
    globalState.generatedAt = new Date().toISOString()
    globalState.refreshPromise = null
    return globalState.jokes
  })().catch((error) => {
    globalState.refreshPromise = null
    throw error
  })
  globalState.refreshPromise = promise
  return promise
}

async function ensureInitialized() {
  if (globalState.initializing) {
    return globalState.initializing
  }
  const promise = refreshAcceptedJokes()
  globalState.initializing = promise
  return promise
}

function normalizeId(id) {
  if (id) {
    return id
  }
  return `custom-${randomUUID()}`
}

export function getCustomJokes() {
  ensureInitialized().catch((error) => {
    console.warn('[customJokes] Initialization failed', {
      error: error?.message || String(error)
    })
  })
  return globalState.jokes.slice()
}

export async function getCustomJokesAsync() {
  await ensureInitialized()
  return globalState.jokes.slice()
}

export function getCustomJokeCount() {
  return getCustomJokes().length
}

export async function recordAcceptedJoke({ opener, response, author }) {
  const client = getDynamoClient()
  const id = normalizeId()
  const payload = createJokePayload({ id, opener, response, author })

  await client.send(new PutCommand({
    TableName: RATINGS_TABLE,
    Item: {
      PK: `CUSTOM_JOKE#${id}`,
      SK: 'METADATA',
      id,
      opener: payload.opener,
      response: payload.response,
      text: payload.text,
      author: payload.author,
      status: 'accepted',
      createdAt: payload.createdAt,
      GSI1PK: 'CUSTOM_JOKES_ACCEPTED',
      GSI1SK: payload.createdAt,
      GSI2PK: `AUTHOR#${payload.author}`,
      GSI2SK: payload.createdAt
    }
  }))

  const normalized = normalizeStoredJoke(payload)
  globalState.jokes.unshift(normalized) // Add to beginning (most recent first)
  globalState.generatedAt = new Date().toISOString()
  return normalized
}

export async function recordRejectedJoke({ opener, response, author, reason }) {
  const client = getDynamoClient()
  const id = normalizeId()
  const payload = createJokePayload({ id, opener, response, author })
  const rejectionReason = reason || 'Rejected by content policy'

  await client.send(new PutCommand({
    TableName: RATINGS_TABLE,
    Item: {
      PK: `CUSTOM_JOKE#${id}`,
      SK: 'METADATA',
      id,
      opener: payload.opener,
      response: payload.response,
      text: payload.text,
      author: payload.author,
      status: 'rejected',
      reason: rejectionReason,
      createdAt: payload.createdAt,
      GSI1PK: 'CUSTOM_JOKES_REJECTED',
      GSI1SK: payload.createdAt
    }
  }))

  return { id, reason: rejectionReason }
}

export function clearCustomJokesCache() {
  globalState.jokes = []
  globalState.generatedAt = null
  globalState.initializing = null
  globalState.refreshPromise = null
}

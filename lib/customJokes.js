import fs from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getObjectJson, listObjectKeys, putObjectJson, storageConfigured } from './s3Storage.js'
import { isSummaryStale, resolveDashboardSummaryTtlMs } from './dashboardSummary.js'

const ACCEPTED_PREFIX = 'custom-jokes/accepted'
const REJECTED_PREFIX = 'custom-jokes/rejected'
const CACHE_FILENAME = 'accepted-cache.json'
const DEFAULT_AUTHOR = 'Anonymous'

const remoteStorageConfigured = storageConfigured

const globalState = globalThis.__customJokesState || {
  jokes: [],
  generatedAt: null,
  initializing: null,
  refreshPromise: null,
  interval: null
}

if (!globalThis.__customJokesState) {
  globalThis.__customJokesState = globalState
}

function resolveCacheDirectory() {
  if (process.env.CUSTOM_JOKES_CACHE_DIR) {
    return path.resolve(process.env.CUSTOM_JOKES_CACHE_DIR)
  }
  if (process.env.VERCEL) {
    return path.join('/tmp', 'custom-jokes')
  }
  return path.join('/tmp', 'custom-jokes')
}

function resolveStorageDirectory() {
  if (process.env.CUSTOM_JOKES_STORAGE_DIR) {
    return path.resolve(process.env.CUSTOM_JOKES_STORAGE_DIR)
  }
  return path.join(resolveCacheDirectory(), 'store')
}

function getCachePath() {
  return path.join(resolveCacheDirectory(), CACHE_FILENAME)
}

function resolveCustomTtlMs(ttlMs) {
  if (Number.isFinite(ttlMs) && ttlMs >= 0) {
    return ttlMs
  }
  const envMs = Number(process.env.CUSTOM_JOKES_TTL_MS)
  if (Number.isFinite(envMs) && envMs >= 0) {
    return envMs
  }
  const envMinutes = Number(process.env.CUSTOM_JOKES_TTL_MINUTES)
  if (Number.isFinite(envMinutes) && envMinutes >= 0) {
    return envMinutes * 60_000
  }
  return resolveDashboardSummaryTtlMs()
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

function normalizeStoredJoke(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const { id, opener, response, author, text } = payload
  const normalizedOpener = normalizeOpener(opener)
  if (!normalizedOpener) {
    return null
  }
  const normalizedResponse = normalizeResponse(response)
  const normalizedAuthor = normalizeAuthor(author)
  const normalizedText = text
    ? String(text)
    : normalizedResponse
      ? `Question: ${normalizedOpener}\nAnswer: ${normalizedResponse}`
      : `Question: ${normalizedOpener}`
  return {
    id: id || `custom-${randomUUID()}`,
    opener: normalizedOpener,
    response: normalizedResponse,
    text: normalizedText,
    author: normalizedAuthor
  }
}

async function writeBlobEntry(pathname, payload) {
  await putObjectJson(pathname, payload, {
    cacheControl: 'no-store',
    contentType: 'application/json'
  })
}

async function ensureLocalDirectory(directory) {
  await mkdir(directory, { recursive: true })
}

async function writeLocalEntry(directory, filename, payload) {
  await ensureLocalDirectory(directory)
  const targetPath = path.join(directory, `${filename}.json`)
  await writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8')
}

async function loadAcceptedFromRemote() {
  const jokes = []
  if (!remoteStorageConfigured) {
    return jokes
  }
  const keys = await listObjectKeys(ACCEPTED_PREFIX)
  for (const key of keys) {
    if (!key.endsWith('.json')) {
      continue
    }
    const payload = await getObjectJson(key).catch(() => null)
    const normalized = normalizeStoredJoke(payload)
    if (normalized) {
      jokes.push(normalized)
    }
  }
  return jokes
}

async function loadAcceptedFromLocal() {
  const jokes = []
  const directory = path.join(resolveStorageDirectory(), 'accepted')
  let entries = []
  try {
    entries = await readdir(directory)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return jokes
    }
    throw error
  }
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue
    }
    const filePath = path.join(directory, entry)
    const raw = await readFile(filePath, 'utf8').catch(() => null)
    if (!raw) {
      continue
    }
    let payload
    try {
      payload = JSON.parse(raw)
    } catch (error) {
      continue
    }
    const normalized = normalizeStoredJoke(payload)
    if (normalized) {
      jokes.push(normalized)
    }
  }
  return jokes
}

async function refreshAcceptedJokes(force = false) {
  const ttlMs = resolveCustomTtlMs()
  const stale = force || isSummaryStale(globalState.generatedAt, { ttlMs })
  if (!stale) {
    return globalState.jokes
  }
  if (globalState.refreshPromise) {
    return globalState.refreshPromise
  }
  const promise = (async () => {
    let jokes = []
    if (remoteStorageConfigured) {
      jokes = await loadAcceptedFromRemote()
    } else {
      jokes = await loadAcceptedFromLocal()
    }
    const normalized = jokes.map((joke) => normalizeStoredJoke(joke)).filter(Boolean)
    globalState.jokes = normalized
    globalState.generatedAt = new Date().toISOString()
    await writeCacheFile({
      generatedAt: globalState.generatedAt,
      jokes: globalState.jokes
    })
    globalState.refreshPromise = null
    return globalState.jokes
  })().catch((error) => {
    globalState.refreshPromise = null
    throw error
  })
  globalState.refreshPromise = promise
  return promise
}

function readCacheFileSync() {
  const cachePath = getCachePath()
  try {
    if (!fs.existsSync(cachePath)) {
      return null
    }
    const raw = fs.readFileSync(cachePath, 'utf8')
    const payload = JSON.parse(raw)
    if (!payload || typeof payload !== 'object') {
      return null
    }
    const jokes = Array.isArray(payload.jokes) ? payload.jokes : []
    return {
      generatedAt: payload.generatedAt || null,
      jokes: jokes.map((item) => normalizeStoredJoke(item)).filter(Boolean)
    }
  } catch (error) {
    return null
  }
}

async function writeCacheFile(payload) {
  const cachePath = getCachePath()
  await ensureLocalDirectory(path.dirname(cachePath))
  await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8')
}

function startRefreshInterval() {
  if (globalState.interval) {
    return
  }
  const ttlMs = resolveCustomTtlMs()
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return
  }
  const interval = setInterval(() => {
    refreshAcceptedJokes().catch((error) => {
      console.warn('[customJokes] Failed to refresh cache', {
        error: error?.message || String(error)
      })
    })
  }, ttlMs)
  if (typeof interval.unref === 'function') {
    interval.unref()
  }
  globalState.interval = interval
}

async function ensureInitialized() {
  if (globalState.initializing) {
    return globalState.initializing
  }
  const cached = readCacheFileSync()
  if (cached) {
    globalState.jokes = cached.jokes
    globalState.generatedAt = cached.generatedAt
  }
  const promise = (async () => {
    await refreshAcceptedJokes(!cached)
    startRefreshInterval()
  })()
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

export function getCustomJokeCount() {
  return getCustomJokes().length
}

export async function recordAcceptedJoke({ opener, response, author }) {
  const id = normalizeId()
  const payload = createJokePayload({ id, opener, response, author })
  if (remoteStorageConfigured) {
    await writeBlobEntry(`${ACCEPTED_PREFIX}/${id}.json`, payload)
  } else {
    await writeLocalEntry(path.join(resolveStorageDirectory(), 'accepted'), id, payload)
  }
  const normalized = normalizeStoredJoke(payload)
  globalState.jokes.push(normalized)
  globalState.generatedAt = new Date().toISOString()
  await writeCacheFile({
    generatedAt: globalState.generatedAt,
    jokes: globalState.jokes
  })
  return normalized
}

export async function recordRejectedJoke({ opener, response, author, reason }) {
  const id = normalizeId()
  const payload = {
    ...createJokePayload({ id, opener, response, author }),
    reason: reason || 'Rejected by content policy'
  }
  if (remoteStorageConfigured) {
    await writeBlobEntry(`${REJECTED_PREFIX}/${id}.json`, payload)
  } else {
    await writeLocalEntry(path.join(resolveStorageDirectory(), 'rejected'), id, payload)
  }
  return { id, reason: payload.reason }
}

export function clearCustomJokesCache() {
  globalState.jokes = []
  globalState.generatedAt = null
  if (globalState.interval) {
    clearInterval(globalState.interval)
    globalState.interval = null
  }
  globalState.initializing = null
  globalState.refreshPromise = null
}


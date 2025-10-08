import { BlobNotFoundError, head, put } from '@vercel/blob'
import { generatePrompt } from '../../lib/generatePrompt.mjs'
import { getOpenAIClient, getRandomLocalJoke } from '../../lib/openaiClient'

const BLOB_PREFIX = 'daily-joke'
const BLOB_TOKEN_ENV_VARS = [
  'DAD_READ_WRITE_TOKEN',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_STORE_READ_WRITE_TOKEN',
  'BLOB_RW_TOKEN',
  'BLOB_TOKEN',
  'VERCEL_BLOB_TOKEN'
]

const blobToken = BLOB_TOKEN_ENV_VARS.map((key) => process.env[key]).find(Boolean)
const blobConfigured = Boolean(blobToken)

const memoryStore = globalThis.__dailyJokeStore || new Map()
if (!globalThis.__dailyJokeStore) {
  globalThis.__dailyJokeStore = memoryStore
}

if (!blobConfigured) {
  console.warn(
    `[daily-joke] Blob token missing; checked env vars: ${BLOB_TOKEN_ENV_VARS.join(', ')}`
  )
}

function getDateKey() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function getBlobPath(dateKey) {
  return `${BLOB_PREFIX}/${dateKey}.json`
}

async function readCachedJoke(dateKey) {
  if (blobConfigured) {
    const path = getBlobPath(dateKey)
    try {
      const metadata = await head(path, blobToken ? { token: blobToken } : undefined)
      const response = await fetch(metadata.downloadUrl)
      if (!response.ok) {
        throw new Error('Unable to download cached joke')
      }
      return await response.json()
    } catch (error) {
      if (error instanceof BlobNotFoundError || error?.name === 'BlobNotFoundError') {
        return null
      }
      throw error
    }
  }
  return memoryStore.get(dateKey) || null
}

async function writeCachedJoke(dateKey, payload) {
  if (blobConfigured) {
    const path = getBlobPath(dateKey)
    const options = {
      access: 'public',
      contentType: 'application/json',
      cacheControl: 'public, max-age=300, s-maxage=300'
    }
    if (blobToken) {
      options.token = blobToken
    }
    await put(path, JSON.stringify(payload), options)
    return
  }
  memoryStore.set(dateKey, payload)
}

async function fetchOnThisDayEvent(dateKey) {
  const [year, month, day] = dateKey.split('-')
  const endpoint = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${Number(
    month
  )}/${Number(day)}`
  const res = await fetch(endpoint)
  if (!res.ok) {
    throw new Error('Unable to fetch historical context')
  }
  const data = await res.json()
  const events = Array.isArray(data?.events) ? data.events : []
  if (events.length === 0) {
    throw new Error('No events available for today')
  }
  // Deterministically pick an event based on the year and index so all deployments agree
  const indexSeed = Number(year) + Number(month) + Number(day)
  const event = events[indexSeed % events.length]
  const page = Array.isArray(event?.pages) ? event.pages[0] : null
  const source = page?.content_urls?.desktop?.page || page?.content_urls?.mobile?.page
  return {
    year: event?.year || null,
    text: event?.text || '',
    title: event?.title || page?.titles?.normalized || '',
    summary: page?.extract || '',
    source: source || null
  }
}

function extractTextFromResponse(response) {
  if (!response) {
    return ''
  }
  if (typeof response === 'string') {
    return response
  }
  if (response.output_text) {
    return response.output_text
  }
  if (Array.isArray(response.output)) {
    const text = response.output
      .flatMap((item) => item?.content || [])
      .map((chunk) => chunk?.text || '')
      .join('')
    if (text) {
      return text
    }
  }
  return ''
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).end('Method Not Allowed')
    return
  }

  const dateKey = getDateKey()

  try {
    const cached = await readCachedJoke(dateKey)
    if (cached) {
      res.status(200).json(cached)
      return
    }
  } catch (error) {
    // Swallow cache read errors so we can try to generate a joke anyway
  }

  try {
    const event = await fetchOnThisDayEvent(dateKey)
    const prompt = generatePrompt({ mode: 'daily', event })
    const openai = getOpenAIClient()
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
      temperature: 0.8,
      stream: false
    })
    const joke = extractTextFromResponse(response)
    const payload = {
      joke: joke || getRandomLocalJoke(),
      context: {
        date: dateKey,
        year: event.year,
        text: event.text,
        summary: event.summary,
        source: event.source
      }
    }
    await writeCachedJoke(dateKey, payload)
    res.status(200).json(payload)
  } catch (error) {
    const fallback = {
      joke: `Question: Why did the calendar apply for a job?\nAnswer: It wanted to take advantage of all its dates!`,
      context: {
        date: dateKey,
        year: null,
        text: 'Unable to fetch on-this-day facts, serving a timeless dad joke instead.',
        summary: '',
        source: null
      }
    }
    res.status(200).json(fallback)
  }
}

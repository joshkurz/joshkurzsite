import fs from 'node:fs/promises'
import path from 'node:path'
import OpenAI from 'openai'
import { getAllJokeTexts } from './jokesData'

let clientPromise = null
let jokesPromise = null

const DEFAULT_PRIMARY_MODEL = process.env.OPENAI_PRIMARY_MODEL || 'gpt-4.1'
const DEFAULT_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4.1'

async function loadLocalJokes() {
  if (!jokesPromise) {
    jokesPromise = (async () => {
      try {
        const jokes = await getAllJokeTexts()
        if (jokes.length > 0) {
          return jokes
        }
      } catch (error) {
        console.warn('[openai] Unable to load jokes from database, falling back to seed file', error)
      }
      try {
        const fallbackPath = path.join(process.cwd(), 'data', 'fatherhood_jokes.json')
        const raw = await fs.readFile(fallbackPath, 'utf8')
        const payload = JSON.parse(raw)
        return payload.map((item) => item.text)
      } catch (error) {
        console.error('[openai] Failed to load fallback jokes', error)
        return []
      }
    })()
  }
  return jokesPromise
}

async function createMockClient() {
  const jokes = await loadLocalJokes()
  return {
    __mock: true,
    responses: {
      async create({ stream }) {
        const joke = jokes[Math.floor(Math.random() * jokes.length)] || 'No jokes available'
        if (stream) {
          async function* generator() {
            for (const char of joke) {
              await new Promise((resolve) => setTimeout(resolve, 5))
              yield { delta: char }
            }
          }
          return generator()
        }
        return { output_text: joke }
      }
    }
  }
}

export async function getOpenAIClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY
      if (process.env.MOCK_OPENAI === 'true' || !apiKey) {
        return createMockClient()
      }
      return new OpenAI({ apiKey })
    })()
  }
  return clientPromise
}

export async function getRandomLocalJoke() {
  const jokes = await loadLocalJokes()
  if (jokes.length === 0) {
    return 'Why did the developer cross the road? To fix the bug on the other side.'
  }
  return jokes[Math.floor(Math.random() * jokes.length)]
}

function getModelPair(stream = false) {
  const primary = stream
    ? process.env.OPENAI_STREAM_MODEL || process.env.OPENAI_RESPONSE_MODEL || DEFAULT_PRIMARY_MODEL
    : process.env.OPENAI_RESPONSE_MODEL || DEFAULT_PRIMARY_MODEL

  const fallback = stream
    ? process.env.OPENAI_STREAM_FALLBACK_MODEL || process.env.OPENAI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL
    : process.env.OPENAI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL

  return [primary, fallback]
}

export function getResponseModels({ stream = false } = {}) {
  const models = getModelPair(stream)
  return models.filter((model, index) => Boolean(model) && models.indexOf(model) === index)
}

export function isVerificationError(error) {
  if (!error) {
    return false
  }
  const message =
    (typeof error.message === 'string' && error.message) ||
    (typeof error?.error?.message === 'string' && error.error.message)
  if (!message) {
    return false
  }
  return message.toLowerCase().includes('must be verified')
}

export async function createResponseWithFallback(openai, params, { stream = false } = {}) {
  const models = getResponseModels({ stream })
  let lastError = null

  for (const model of models) {
    try {
      const client = await openai
      return await client.responses.create({ ...params, model })
    } catch (error) {
      lastError = error
      const shouldRetry = isVerificationError(error)
      const hasAnotherModel = model !== models[models.length - 1]
      if (shouldRetry && hasAnotherModel) {
        console.warn('[openai] Falling back to alternate model', {
          attemptedModel: model,
          error: error?.message || String(error)
        })
        continue
      }
      throw error
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('No OpenAI models are configured')
}

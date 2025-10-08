import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

let cachedClient = null
let cachedJokes = null

const DEFAULT_PRIMARY_MODEL = process.env.OPENAI_PRIMARY_MODEL || 'gpt-5'
const DEFAULT_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4.1'

function loadLocalJokes() {
  if (cachedJokes) {
    return cachedJokes
  }
  const jokesPath = path.join(process.cwd(), 'data', 'dad_jokes.txt')
  const jokes = fs
    .readFileSync(jokesPath, 'utf-8')
    .split('\n\n')
    .filter(Boolean)
  cachedJokes = jokes
  return jokes
}

function createMockClient() {
  const jokes = loadLocalJokes()
  return {
    __mock: true,
    responses: {
      async create({ stream }) {
        const joke = jokes[Math.floor(Math.random() * jokes.length)]
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

export function getOpenAIClient() {
  if (cachedClient) {
    return cachedClient
  }
  const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY
  if (process.env.MOCK_OPENAI === 'true' || !apiKey) {
    cachedClient = createMockClient()
    return cachedClient
  }
  cachedClient = new OpenAI({
    apiKey
  })
  return cachedClient
}

export function getRandomLocalJoke() {
  const jokes = loadLocalJokes()
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

  for (const [index, model] of models.entries()) {
    try {
      const requestParams = { ...params, model }

      if (params.reasoning && typeof params.reasoning === 'object' && params.reasoning !== null) {
        requestParams.reasoning = { ...params.reasoning }
      }

      if (params.text && typeof params.text === 'object' && params.text !== null) {
        requestParams.text = { ...params.text }
      }

      if (index > 0) {
        if (requestParams.reasoning && typeof requestParams.reasoning === 'object') {
          const cleanedReasoning = { ...requestParams.reasoning }
          delete cleanedReasoning.effort
          if (Object.keys(cleanedReasoning).length === 0) {
            delete requestParams.reasoning
          } else {
            requestParams.reasoning = cleanedReasoning
          }
        }

        if (requestParams.text && typeof requestParams.text === 'object') {
          const cleanedText = { ...requestParams.text }
          delete cleanedText.verbosity
          if (Object.keys(cleanedText).length === 0) {
            delete requestParams.text
          } else {
            requestParams.text = cleanedText
          }
        }

        if ('verbosity' in requestParams) {
          delete requestParams.verbosity
        }
      }

      return await openai.responses.create(requestParams)
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

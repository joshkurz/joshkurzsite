import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

let cachedClient = null
let cachedJokes = null

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

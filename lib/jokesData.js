import fs from 'fs'
import path from 'path'
import { loadCustomJokes } from './customJokes'

let cachedFatherhoodJokes = null

function loadRawData() {
  if (cachedFatherhoodJokes) {
    return cachedFatherhoodJokes
  }
  const filePath = path.join(process.cwd(), 'data', 'fatherhood_jokes.json')
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  cachedFatherhoodJokes = payload.map((item) => {
    const opener = (item.opener || '').trim()
    const response = item.response ? item.response.trim() : null
    const text = item.text || (response ? `Question: ${opener}\nAnswer: ${response}` : `Question: ${opener}`)
    return {
      id: item.id || `fatherhood-${item.sourceId}`,
      sourceId: item.sourceId || null,
      opener,
      response,
      text,
      author: item.author || 'fatherhood.gov'
    }
  })
  return cachedFatherhoodJokes
}

export async function getAllJokes() {
  const [custom, fallback] = await Promise.all([loadCustomJokes(), Promise.resolve(loadRawData())])
  return [...custom, ...fallback]
}

export async function getRandomJoke() {
  const [custom, fallbackJokes] = await Promise.all([loadCustomJokes(), Promise.resolve(loadRawData())])
  const jokes = custom.length > 0 ? [...custom, ...fallbackJokes] : fallbackJokes
  if (jokes.length === 0) {
    throw new Error('No jokes available')
  }
  const index = Math.floor(Math.random() * jokes.length)
  return jokes[index]
}

export async function getAllJokeTexts() {
  const jokes = await getAllJokes()
  return jokes.map((joke) => joke.text)
}

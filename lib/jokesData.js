import fs from 'fs'
import path from 'path'
import { getCustomJokes } from './customJokes'

let cachedJokes = null

function loadRawData() {
  if (cachedJokes) {
    return cachedJokes
  }
  const filePath = path.join(process.cwd(), 'data', 'fatherhood_jokes.json')
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  cachedJokes = payload.map((item) => {
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
  return cachedJokes
}

export function getAllJokes() {
  const custom = getCustomJokes()
  return [...custom, ...loadRawData()]
}

export function getRandomJoke() {
  const fallbackJokes = loadRawData()
  const custom = getCustomJokes()
  const jokes = custom.length > 0 ? [...custom, ...fallbackJokes] : fallbackJokes
  if (jokes.length === 0) {
    throw new Error('No jokes available')
  }
  const index = Math.floor(Math.random() * jokes.length)
  return jokes[index]
}

export function getAllJokeTexts() {
  return getAllJokes().map((joke) => joke.text)
}

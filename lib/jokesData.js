import fs from 'fs'
import path from 'path'

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
      text
    }
  })
  return cachedJokes
}

export function getAllJokes() {
  return loadRawData().slice()
}

export function getRandomJoke() {
  const jokes = loadRawData()
  if (jokes.length === 0) {
    throw new Error('No jokes available')
  }
  const index = Math.floor(Math.random() * jokes.length)
  return jokes[index]
}

export function getAllJokeTexts() {
  return loadRawData().map((joke) => joke.text)
}

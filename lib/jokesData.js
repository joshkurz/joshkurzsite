import fs from 'fs'
import path from 'path'
import { getCustomJokes, getCustomJokesAsync } from './customJokes.js'

let cachedJokes = null

function loadFile(filename) {
  const filePath = path.join(process.cwd(), 'data', filename)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return []
  }
}

function normalizeFatherhood(item) {
  const opener = (item.opener || '').trim()
  const response = item.response ? item.response.trim() : null
  const text = item.text || (response ? `Question: ${opener}\nAnswer: ${response}` : `Question: ${opener}`)
  return {
    id: item.id || `fatherhood-${item.sourceId}`,
    sourceId: item.sourceId || null,
    opener,
    response,
    text,
    author: item.author || 'fatherhood.gov',
  }
}

function normalizeExternal(item) {
  return {
    id: item.id,
    sourceId: item.sourceId || null,
    opener: (item.opener || '').trim(),
    response: item.response || null,
    text: item.text || (item.opener || '').trim(),
    author: item.author || null,
  }
}

function loadRawData() {
  if (cachedJokes) {
    return cachedJokes
  }
  const fatherhood = loadFile('fatherhood_jokes.json').map(normalizeFatherhood)
  const external = loadFile('external_jokes.json').map(normalizeExternal)
  cachedJokes = [...fatherhood, ...external]
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

export async function getRandomJokeAsync() {
  const fallbackJokes = loadRawData()
  const custom = await getCustomJokesAsync()
  const jokes = custom.length > 0 ? [...custom, ...fallbackJokes] : fallbackJokes
  if (jokes.length === 0) {
    throw new Error('No jokes available')
  }
  const index = Math.floor(Math.random() * jokes.length)
  return jokes[index]
}

export async function getAllJokesAsync() {
  const fallbackJokes = loadRawData()
  const custom = await getCustomJokesAsync()
  return custom.length > 0 ? [...custom, ...fallbackJokes] : fallbackJokes
}

export function getAllJokeTexts() {
  return getAllJokes().map((joke) => joke.text)
}

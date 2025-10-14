import fs from 'node:fs/promises'
import path from 'node:path'
import { query } from './db'

let seedPromise = null

async function loadSeedData() {
  const filePath = path.join(process.cwd(), 'data', 'fatherhood_jokes.json')
  const raw = await fs.readFile(filePath, 'utf8')
  const payload = JSON.parse(raw)
  return payload.map((item) => {
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
}

async function seedJokesIfNeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await query(`SELECT COUNT(*)::int AS count FROM jokes WHERE source = 'fatherhood'`)
      if (Number(existing.rows[0]?.count || 0) > 0) {
        return
      }
      const seedData = await loadSeedData()
      for (const item of seedData) {
        await query(
          `INSERT INTO jokes (id, source_id, opener, response, text, author, source, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'fatherhood', NOW())
             ON CONFLICT (id) DO NOTHING`,
          [item.id, item.sourceId, item.opener, item.response, item.text, item.author]
        )
      }
    })()
  }
  return seedPromise
}

function mapRow(row) {
  return {
    id: row.id,
    sourceId: row.source_id,
    opener: row.opener,
    response: row.response,
    text: row.text,
    author: row.author,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  }
}

export async function getAllJokes() {
  await seedJokesIfNeeded()
  const result = await query(
    `SELECT id, source_id, opener, response, text, author, created_at
       FROM jokes
      ORDER BY created_at DESC`
  )
  return result.rows.map(mapRow)
}

export async function getRandomJoke() {
  await seedJokesIfNeeded()
  const countResult = await query(`SELECT COUNT(*)::int AS count FROM jokes`)
  const total = Number(countResult.rows[0]?.count || 0)
  if (total === 0) {
    throw new Error('No jokes available')
  }
  const offset = Math.floor(Math.random() * total)
  const result = await query(
    `SELECT id, source_id, opener, response, text, author, created_at
       FROM jokes
      ORDER BY id
      OFFSET $1
      LIMIT 1`,
    [offset]
  )
  if (result.rows.length === 0) {
    throw new Error('No jokes available')
  }
  return mapRow(result.rows[0])
}

export async function getAllJokeTexts() {
  await seedJokesIfNeeded()
  const result = await query(`SELECT text FROM jokes ORDER BY created_at DESC`)
  return result.rows.map((row) => row.text)
}

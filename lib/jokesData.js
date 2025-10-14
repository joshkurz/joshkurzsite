import { query } from './db'
import { ensureFatherhoodSeed } from './jokesSeed.js'

async function seedJokesIfNeeded() {
  await ensureFatherhoodSeed(query)
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

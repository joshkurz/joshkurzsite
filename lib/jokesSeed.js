import fs from 'node:fs/promises'
import path from 'node:path'

let cachedSeedData = null

function normalizeSeedRecord(item) {
  const opener = (item.opener || '').trim()
  const response = item.response ? item.response.trim() : null
  const text =
    item.text || (response ? `Question: ${opener}\nAnswer: ${response}` : `Question: ${opener}`)

  return {
    id: item.id || `fatherhood-${item.sourceId}`,
    sourceId: item.sourceId || null,
    opener,
    response,
    text,
    author: item.author || 'fatherhood.gov'
  }
}

export async function loadFatherhoodSeedData() {
  if (cachedSeedData) {
    return cachedSeedData
  }

  const filePath = path.join(process.cwd(), 'data', 'fatherhood_jokes.json')
  const raw = await fs.readFile(filePath, 'utf8')
  const payload = JSON.parse(raw)
  cachedSeedData = payload.map(normalizeSeedRecord)
  return cachedSeedData
}

export async function ensureFatherhoodSeed(executeQuery) {
  if (typeof executeQuery !== 'function') {
    throw new Error('ensureFatherhoodSeed requires a query executor function')
  }

  const existing = await executeQuery(
    `SELECT COUNT(*)::int AS count FROM jokes WHERE source = $1`,
    ['fatherhood']
  )

  const count = Number(existing.rows?.[0]?.count || 0)
  if (count > 0) {
    return
  }

  const seedData = await loadFatherhoodSeedData()
  for (const item of seedData) {
    // eslint-disable-next-line no-await-in-loop
    await executeQuery(
      `INSERT INTO jokes (id, source_id, opener, response, text, author, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'fatherhood', NOW())
         ON CONFLICT (id) DO NOTHING`,
      [item.id, item.sourceId, item.opener, item.response, item.text, item.author]
    )
  }
}

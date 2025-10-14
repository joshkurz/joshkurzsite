import { getDatabasePool } from '../lib/db.js'

async function main() {
  const pool = await getDatabasePool()
  const seeded = await pool.query(`SELECT COUNT(*)::int AS count FROM jokes WHERE source = 'fatherhood'`)
  const totalJokes = Number(seeded.rows?.[0]?.count || 0)

  console.log(`Database ready. Fatherhood.gov jokes synchronized (${totalJokes} rows).`)

  if (typeof pool.end === 'function') {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[db-bootstrap] Failed to prepare database', error)
  process.exitCode = 1
})

/**
 * Fetches jokes from two external sources and saves to data/external_jokes.json
 *
 * Sources:
 *   - icanhazdadjoke.com  (full catalog via paginated search API)
 *   - reddit.com/r/dadjokes  (top all-time, Reddit API max ~1000)
 *
 * Only Q&A jokes are kept: must have a question (ends with ?) and a punchline.
 * Jokes that can't be split are filtered out and counted.
 *
 * Usage: node scripts/fetch-external-jokes.mjs
 */

import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'external_jokes.json')

// ---------------------------------------------------------------------------
// Q&A splitting
// ---------------------------------------------------------------------------

/**
 * Attempts to split a joke string into opener (question) and response (punchline).
 * Splits on the first `?`. Returns null if no valid Q&A structure is found.
 */
function toQA(text) {
  const qIndex = text.indexOf('?')
  if (qIndex === -1) return null
  const opener = text.slice(0, qIndex + 1).trim()
  const response = text.slice(qIndex + 1).trim()
  if (!opener || !response) return null
  return { opener, response, text: `Question: ${opener}\nAnswer: ${response}` }
}

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function fetchJson(url, headers = {}) {
  const headerArgs = Object.entries(headers).flatMap(([k, v]) => ['-H', `${k}: ${v}`])
  const { stdout } = await execFileAsync('curl', [
    '--globoff', '-s', '-L',
    '-H', 'User-Agent: joshkurz-dadjokes-fetcher/1.0 (https://joshkurz.net)',
    ...headerArgs,
    url,
  ])
  if (!stdout.trim()) throw new Error(`Empty response from ${url}`)
  return JSON.parse(stdout)
}

// ---------------------------------------------------------------------------
// icanhazdadjoke.com
// ---------------------------------------------------------------------------

async function fetchIcanhazdadjoke() {
  console.log('Fetching from icanhazdadjoke.com...')
  const jokes = []
  const seen = new Set()
  let filtered = 0
  let page = 1
  const limit = 30

  while (true) {
    const data = await fetchJson(
      `https://icanhazdadjoke.com/search?limit=${limit}&page=${page}`,
      { Accept: 'application/json' }
    )

    for (const item of data.results || []) {
      if (seen.has(item.id) || !item.joke) continue
      seen.add(item.id)

      const qa = toQA(item.joke.trim())
      if (!qa) { filtered++; continue }

      jokes.push({
        id: `icanhaz-${item.id}`,
        sourceId: item.id,
        opener: qa.opener,
        response: qa.response,
        text: qa.text,
        author: 'icanhazdadjoke.com',
      })
    }

    if (page >= (data.total_pages || 1)) break
    page++
  }

  console.log(`  icanhazdadjoke.com: kept ${jokes.length}, filtered ${filtered} (no Q&A structure)`)
  return jokes
}

// ---------------------------------------------------------------------------
// Reddit r/dadjokes (top all-time)
// ---------------------------------------------------------------------------

async function fetchReddit() {
  console.log('Fetching from reddit.com/r/dadjokes (max 1000, Reddit API limit)...')
  const jokes = []
  const seen = new Set()
  let filtered = 0
  let after = null

  while (true) {
    const url = `https://www.reddit.com/r/dadjokes/top.json?t=all&limit=100${after ? `&after=${after}` : ''}`
    const data = await fetchJson(url)
    const posts = data?.data?.children || []

    for (const { data: post } of posts) {
      if (seen.has(post.id) || !post.title || post.stickied) continue
      seen.add(post.id)

      const title = post.title.trim()
      const rawBody = (post.selftext || '').trim()
      const body = rawBody && rawBody !== '[removed]' && rawBody !== '[deleted]' ? rawBody : null

      let opener, response, text

      if (body) {
        // Post has title + selftext — already Q&A
        opener = title
        response = body
        text = `Question: ${opener}\nAnswer: ${response}`
      } else {
        // Title only — try to split on ?
        const qa = toQA(title)
        if (!qa) { filtered++; continue }
        ;({ opener, response, text } = qa)
      }

      jokes.push({
        id: `reddit-dadjokes-${post.id}`,
        sourceId: post.id,
        opener,
        response,
        text,
        author: 'reddit.com/r/dadjokes',
      })
    }

    after = data?.data?.after
    if (!after || posts.length === 0) break
  }

  console.log(`  reddit.com/r/dadjokes: kept ${jokes.length}, filtered ${filtered} (no Q&A structure)`)
  return jokes
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    const [icanhaz, reddit] = await Promise.all([
      fetchIcanhazdadjoke(),
      fetchReddit(),
    ])

    const all = [...icanhaz, ...reddit]
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(all, null, 2) + '\n', 'utf8')
    console.log(`\nSaved ${all.length} total jokes to ${OUTPUT_PATH}`)
  } catch (err) {
    console.error('Failed to fetch external jokes:', err)
    process.exitCode = 1
  }
}

main()

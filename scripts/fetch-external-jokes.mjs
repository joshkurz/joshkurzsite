/**
 * Fetches jokes from two external sources and saves to data/external_jokes.json
 *
 * Sources:
 *   - icanhazdadjoke.com  (100 jokes via paginated search API)
 *   - reddit.com/r/dadjokes  (top 100 all-time via Reddit JSON API)
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
      const text = item.joke.trim()
      jokes.push({
        id: `icanhaz-${item.id}`,
        sourceId: item.id,
        opener: text,
        response: null,
        text,
        author: 'icanhazdadjoke.com',
      })
    }

    if (page >= (data.total_pages || 1)) break
    page++
  }

  console.log(`  Got ${jokes.length} jokes from icanhazdadjoke.com`)
  return jokes
}

// ---------------------------------------------------------------------------
// Reddit r/dadjokes (top all-time)
// ---------------------------------------------------------------------------

function parseRedditJoke(post) {
  const opener = (post.title || '').trim()
  // selftext contains the punchline on text posts; ignore link posts and [removed]
  const rawBody = (post.selftext || '').trim()
  const response = rawBody && rawBody !== '[removed]' && rawBody !== '[deleted]'
    ? rawBody
    : null
  const text = response
    ? `${opener}\n${response}`
    : opener
  return { opener, response, text }
}

async function fetchReddit() {
  console.log('Fetching from reddit.com/r/dadjokes (max 1000, Reddit API limit)...')
  const jokes = []
  const seen = new Set()
  let after = null

  while (true) {
    const url = `https://www.reddit.com/r/dadjokes/top.json?t=all&limit=100${after ? `&after=${after}` : ''}`
    const data = await fetchJson(url)
    const posts = data?.data?.children || []

    for (const { data: post } of posts) {
      if (seen.has(post.id) || !post.title || post.stickied) continue
      seen.add(post.id)
      const { opener, response, text } = parseRedditJoke(post)
      if (!opener) continue
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

  console.log(`  Got ${jokes.length} jokes from reddit.com/r/dadjokes`)
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

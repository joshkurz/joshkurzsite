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
// Quality filtering
// ---------------------------------------------------------------------------

/**
 * Patterns that identify Reddit meta-posts, warnings, or non-jokes in the opener.
 * These are posts about the subreddit, content warnings, or story preambles —
 * not actual jokes.
 */
const META_OPENER_PATTERNS = [
  /^\[nsfw\]/i,           // [NSFW] content warnings
  /^\(nsfw\)/i,
  /^nsfw:/i,
  /^\[warning/i,          // [warning 18+] etc
  /^\(warning/i,
  /^warning:/i,
  /^not a joke/i,         // explicitly not a joke
  /^is this sub/i,        // meta question about the subreddit
  /^an open letter/i,     // letters to mods/community
  /^the \w+ unwritten/i,  // "The two unwritten rules of..."
  /r\/dadjokes/i,         // references to the subreddit itself
  /^psa:/i,               // public service announcements
  /^true story:/i,        // narrative posts
  /^this just happened/i,
  /^breaking:/i,          // news-style posts
  /^unpopular opinion/i,
  /^does anyone else/i,
  /^who else/i,
  /^genuine question/i,
  /^when you thought/i,   // "When you thought you've seen all the jokes..."
]

/**
 * Strip Reddit edit notes appended to responses (e.g. "\n\nEdit: thanks for gold!")
 * and trim the result.
 */
function stripEditNotes(text) {
  return text
    .replace(/\n\n?edit\b.*/is, '')  // remove Edit: ... to end of string
    .replace(/\n\n?update\b.*/is, '') // same for Update:
    .trim()
}

/**
 * Returns true if the response looks like a real punchline.
 * Filters out broken parses (lone quote marks), numbers-only, and very short garbage.
 */
function isValidResponse(response) {
  const r = response.trim()
  if (r.length < 2) return false
  if (/^["'`]+$/.test(r)) return false   // just punctuation (broken parse artifact)
  if (/^\d+$/.test(r)) return false       // just a number ("1", "19", etc.)
  if (/^\d+\s*[=:]\s*\d+$/.test(r)) return false  // "19 = 37" arithmetic non-jokes
  return true
}

/**
 * Full quality check for a candidate joke. Returns { ok, reason } so we can
 * count why jokes are filtered.
 */
function qualityCheck(opener, response) {
  if (META_OPENER_PATTERNS.some(p => p.test(opener))) {
    return { ok: false, reason: 'meta/non-joke opener' }
  }
  const cleaned = stripEditNotes(response)
  if (!isValidResponse(cleaned)) {
    return { ok: false, reason: 'invalid response' }
  }
  return { ok: true, response: cleaned }
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
  const filterReasons = {}
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
      if (!qa) {
        filterReasons['no Q&A structure'] = (filterReasons['no Q&A structure'] || 0) + 1
        continue
      }

      const quality = qualityCheck(qa.opener, qa.response)
      if (!quality.ok) {
        filterReasons[quality.reason] = (filterReasons[quality.reason] || 0) + 1
        continue
      }

      jokes.push({
        id: `icanhaz-${item.id}`,
        sourceId: item.id,
        opener: qa.opener,
        response: quality.response,
        text: `Question: ${qa.opener}\nAnswer: ${quality.response}`,
        author: 'icanhazdadjoke.com',
      })
    }

    if (page >= (data.total_pages || 1)) break
    page++
  }

  const totalFiltered = Object.values(filterReasons).reduce((a, b) => a + b, 0)
  console.log(`  icanhazdadjoke.com: kept ${jokes.length}, filtered ${totalFiltered}`)
  Object.entries(filterReasons).forEach(([r, n]) => console.log(`    - ${n} filtered: ${r}`))
  return jokes
}

// ---------------------------------------------------------------------------
// Reddit r/dadjokes (top all-time)
// ---------------------------------------------------------------------------

async function fetchReddit() {
  console.log('Fetching from reddit.com/r/dadjokes (max 1000, Reddit API limit)...')
  const jokes = []
  const seen = new Set()
  const filterReasons = {}
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

      let opener, response

      if (body) {
        opener = title
        response = body
      } else {
        const qa = toQA(title)
        if (!qa) {
          filterReasons['no Q&A structure'] = (filterReasons['no Q&A structure'] || 0) + 1
          continue
        }
        opener = qa.opener
        response = qa.response
      }

      const quality = qualityCheck(opener, response)
      if (!quality.ok) {
        filterReasons[quality.reason] = (filterReasons[quality.reason] || 0) + 1
        continue
      }

      jokes.push({
        id: `reddit-dadjokes-${post.id}`,
        sourceId: post.id,
        opener,
        response: quality.response,
        text: `Question: ${opener}\nAnswer: ${quality.response}`,
        author: 'reddit.com/r/dadjokes',
      })
    }

    after = data?.data?.after
    if (!after || posts.length === 0) break
  }

  const totalFiltered = Object.values(filterReasons).reduce((a, b) => a + b, 0)
  console.log(`  reddit.com/r/dadjokes: kept ${jokes.length}, filtered ${totalFiltered}`)
  Object.entries(filterReasons).forEach(([r, n]) => console.log(`    - ${n} filtered: ${r}`))
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

import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const CURL_ARGS = [
  '--globoff',
  '-s',
  '-H',
  "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  '-H',
  'Accept: application/vnd.api+json'
]

const BASE_URL = 'https://www.fatherhood.gov/jsonapi/node/dad_jokes?filter[status][value]=1'

function normalizeUrl(input, fallback) {
  if (!input) return null
  const rawUrl = input.startsWith('http://') || input.startsWith('https://')
    ? input.replace('http://', 'https://')
    : new URL(input, fallback || BASE_URL).toString()
  const parsed = new URL(rawUrl)
  parsed.search = parsed.search.replace(/%5B/g, '[').replace(/%5D/g, ']')
  return parsed.toString()
}

async function fetchJson(url) {
  const { stdout } = await execFileAsync('curl', [...CURL_ARGS, url])
  if (!stdout) {
    throw new Error(`Empty response from ${url}`)
  }
  const data = JSON.parse(stdout)
  if (data.errors) {
    const error = data.errors[0]
    throw new Error(`API error: ${error?.status || ''} ${error?.detail || ''}`.trim())
  }
  return data
}

async function fetchAllJokes() {
  const jokes = []
  const seen = new Set()
  let nextUrl = BASE_URL

  while (nextUrl) {
    let payload
    try {
      payload = await fetchJson(nextUrl)
    } catch (error) {
      console.warn(`Stopping pagination at ${nextUrl}: ${error.message}`)
      break
    }
    for (const item of payload.data || []) {
      const attributes = item?.attributes || {}
      const rawId = attributes.drupal_internal__nid
      const opener = (attributes.field_joke_opener || '').trim()
      const responseText = (attributes.field_joke_response || '').trim()
      if (!rawId || !opener) {
        continue
      }
      if (seen.has(rawId)) {
        continue
      }
      seen.add(rawId)
      jokes.push({
        id: `fatherhood-${rawId}`,
        sourceId: rawId,
        opener,
        response: responseText || null,
        text: responseText ? `Question: ${opener}\nAnswer: ${responseText}` : `Question: ${opener}`
      })
    }
    const nextLink = normalizeUrl(payload?.links?.next?.href, nextUrl)
    if (!nextLink || nextLink === nextUrl) {
      break
    }
    nextUrl = nextLink
  }

  jokes.sort((a, b) => a.sourceId - b.sourceId)
  return jokes
}

async function main() {
  try {
    const jokes = await fetchAllJokes()
    const outputPath = path.join(process.cwd(), 'data', 'fatherhood_jokes.json')
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, JSON.stringify(jokes, null, 2) + '\n', 'utf8')
    console.log(`Saved ${jokes.length} jokes to ${outputPath}`)
  } catch (error) {
    console.error('Failed to fetch jokes', error)
    process.exitCode = 1
  }
}

main()

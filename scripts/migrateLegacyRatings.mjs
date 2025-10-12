#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import {
  buildRatingEvent,
  getMode,
  isAwsConfigured,
  recordRatingEvent,
  resolveDateKey,
  validateRating
} from '../lib/ratingsStorage.js'

function printUsage() {
  console.log(`Usage: node scripts/migrateLegacyRatings.mjs --input <path> [--enqueue]

Options:
  --input <path>      Path to a JSON file containing an array of legacy rating objects. Use '-' to read from STDIN.
  --enqueue           Forward migrated ratings to SQS in addition to writing to DynamoDB (defaults to disabled).
  --help              Show this message.

Environment variables:
  LEGACY_RATINGS_PATH Path to the JSON file if --input is omitted.
`)
}

function parseArguments(argv) {
  const args = [...argv]
  const options = {
    inputPath: null,
    enqueue: false
  }

  while (args.length) {
    const token = args.shift()
    if (token === '--input') {
      const value = args.shift()
      if (!value) {
        throw new Error('--input option requires a file path')
      }
      options.inputPath = value
    } else if (token === '--enqueue') {
      options.enqueue = true
    } else if (token === '--help' || token === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  return options
}

async function readLegacyPayload({ inputPath }) {
  const resolvedPath = inputPath || process.env.LEGACY_RATINGS_PATH || null

  if (resolvedPath === '-' || (!resolvedPath && !process.stdin.isTTY)) {
    const chunks = []
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk))
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim()
    return raw ? JSON.parse(raw) : []
  }

  if (!resolvedPath) {
    throw new Error('No legacy ratings input supplied. Pass --input <path> or set LEGACY_RATINGS_PATH.')
  }

  const absolute = path.isAbsolute(resolvedPath)
    ? resolvedPath
    : path.join(process.cwd(), resolvedPath)
  const file = await fs.readFile(absolute, 'utf8')
  return JSON.parse(file)
}

function normalizeEntries(payload) {
  if (!Array.isArray(payload)) {
    throw new Error('Legacy ratings payload must be an array of rating objects')
  }
  return payload
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2))

    if (options.help) {
      printUsage()
      process.exit(0)
      return
    }

    if (!isAwsConfigured()) {
      console.error('AWS credentials, region, and RATINGS_TABLE_NAME must be configured before migrating.')
      process.exit(1)
      return
    }

    const payload = await readLegacyPayload(options)
    const entries = normalizeEntries(payload)

    let migrated = 0
    let skipped = 0
    let failed = 0

    for (const entry of entries) {
      const rating = validateRating(entry.rating)
      if (!rating) {
        skipped += 1
        continue
      }
      const jokeId = entry.jokeId || null
      if (!jokeId) {
        skipped += 1
        continue
      }
      try {
        const event = buildRatingEvent({
          jokeId,
          rating,
          joke: entry.joke || null,
          mode: getMode(entry.mode),
          dateKey: resolveDateKey(entry.date),
          submittedAt: entry.submittedAt || null,
          eventId: entry.eventId || null
        })
        await recordRatingEvent(event, { enqueue: options.enqueue })
        migrated += 1
      } catch (error) {
        failed += 1
        console.error('[migration] Failed to migrate rating', { entry, error })
      }
    }

    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed.`)
    if (failed > 0) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

await main()

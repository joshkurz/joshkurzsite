#!/usr/bin/env node
import { setInterval as setIntervalTimer } from 'node:timers'
import process from 'node:process'
import { writeSummaryFile } from '../lib/dashboardSummary.js'
import { summarizeRatings } from '../lib/ratingsStorage.js'

const DEFAULT_INTERVAL_MINUTES = 5

function parseIntervalMinutes() {
  const flagIndex = process.argv.findIndex((arg) => arg === '--interval' || arg === '-i')
  if (flagIndex !== -1) {
    const value = Number(process.argv[flagIndex + 1])
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }
  const envMinutes = Number(process.env.DASHBOARD_SUMMARY_INTERVAL_MINUTES)
  if (Number.isFinite(envMinutes) && envMinutes > 0) {
    return envMinutes
  }
  return DEFAULT_INTERVAL_MINUTES
}

async function updateSummaryOnce() {
  const start = Date.now()
  process.stdout.write('[dashboard-summary] Generating summary...\n')
  const summary = await summarizeRatings()
  const duration = Date.now() - start
  const payload = await writeSummaryFile(summary)
  process.stdout.write(
    `[dashboard-summary] Summary written at ${payload.generatedAt} (took ${duration}ms)\n`
  )
}

async function main() {
  const runContinuously = process.argv.includes('--watch') || process.argv.includes('--loop')

  await updateSummaryOnce()

  if (!runContinuously) {
    return
  }

  const intervalMinutes = parseIntervalMinutes()
  const intervalMs = intervalMinutes * 60_000
  process.stdout.write(
    `[dashboard-summary] Watching for updates every ${intervalMinutes} minute(s).\n`
  )
  setIntervalTimer(() => {
    updateSummaryOnce().catch((error) => {
      console.error('[dashboard-summary] Error updating summary', error)
    })
  }, intervalMs)
}

main().catch((error) => {
  console.error('[dashboard-summary] Failed to update summary', error)
  process.exitCode = 1
})

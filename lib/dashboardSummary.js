import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { summarizeRatings } from './ratingsStorage.js'

const SUMMARY_FILENAME = 'dashboard-summary.json'
const DEFAULT_TTL_MINUTES = 5

function resolveSummaryDirectory() {
  const explicitDirectory =
    process.env.DASHBOARD_SUMMARY_DIR || process.env.DASHBOARD_SUMMARY_DIRECTORY
  if (explicitDirectory) {
    return path.resolve(explicitDirectory)
  }

  const explicitFile = process.env.DASHBOARD_SUMMARY_PATH
  if (explicitFile) {
    return path.dirname(path.resolve(explicitFile))
  }

  if (process.env.VERCEL) {
    return path.join('/tmp', 'dashboard-summary')
  }

  return path.join(process.cwd(), 'data')
}

function resolveSummaryPath() {
  const explicitFile = process.env.DASHBOARD_SUMMARY_PATH
  if (explicitFile) {
    return path.resolve(explicitFile)
  }

  return path.join(resolveSummaryDirectory(), SUMMARY_FILENAME)
}

function resolveTtlMs(ttlMs) {
  if (Number.isFinite(ttlMs) && ttlMs >= 0) {
    return ttlMs
  }
  const envMs = Number(process.env.DASHBOARD_SUMMARY_TTL_MS)
  if (Number.isFinite(envMs) && envMs >= 0) {
    return envMs
  }
  const envMinutes = Number(process.env.DASHBOARD_SUMMARY_TTL_MINUTES)
  if (Number.isFinite(envMinutes) && envMinutes >= 0) {
    return envMinutes * 60_000
  }
  return DEFAULT_TTL_MINUTES * 60_000
}

export function getSummaryFilePath() {
  return resolveSummaryPath()
}

export function resolveDashboardSummaryTtlMs(ttlMs) {
  return resolveTtlMs(ttlMs)
}

export async function writeSummaryFile(summary, { generatedAt = new Date().toISOString() } = {}) {
  const summaryPath = resolveSummaryPath()
  await mkdir(path.dirname(summaryPath), { recursive: true })
  const payload = {
    generatedAt,
    summary
  }
  await writeFile(summaryPath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

export async function readSummaryFile() {
  const summaryPath = resolveSummaryPath()
  try {
    const raw = await readFile(summaryPath, 'utf8')
    const payload = JSON.parse(raw)
    if (!payload || typeof payload !== 'object') {
      return null
    }
    return {
      summary: payload.summary || null,
      generatedAt: payload.generatedAt || null
    }
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null
    }
    throw error
  }
}

export function isSummaryStale(generatedAt, { ttlMs } = {}) {
  if (!generatedAt) {
    return true
  }
  const effectiveTtlMs = resolveTtlMs(ttlMs)
  if (effectiveTtlMs === 0) {
    return false
  }
  const generatedTime = Number(new Date(generatedAt).getTime())
  if (!Number.isFinite(generatedTime)) {
    return true
  }
  return Date.now() - generatedTime > effectiveTtlMs
}

export async function loadDashboardSummary({ ttlMs, regenerateIfStale = true } = {}) {
  const existing = await readSummaryFile()
  if (existing && !isSummaryStale(existing.generatedAt, { ttlMs })) {
    return { ...existing, stale: false }
  }

  if (existing && !regenerateIfStale) {
    return { ...existing, stale: true }
  }

  const summary = await summarizeRatings()
  const payload = await writeSummaryFile(summary)
  return { ...payload, stale: false }
}

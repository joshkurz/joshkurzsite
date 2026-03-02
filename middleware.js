import { NextResponse } from 'next/server'

const WINDOW_MS = 60_000

const LIMITS = {
  '/api/ai-joke': 10,
  '/api/speak': 10,
  '/api/custom-jokes': 5,
}

// ip -> { path -> timestamp[] }
const log = new Map()

function getIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

function isRateLimited(ip, path) {
  const limit = LIMITS[path]
  if (!limit) return false

  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const ipEntry = log.get(ip) || {}
  const timestamps = (ipEntry[path] || []).filter((t) => t > windowStart)

  if (timestamps.length >= limit) {
    ipEntry[path] = timestamps
    log.set(ip, ipEntry)
    return true
  }

  timestamps.push(now)
  ipEntry[path] = timestamps
  log.set(ip, ipEntry)

  // Evict the IP entry if all path buckets are now empty to bound Map growth
  const hasAnyTimestamps = Object.values(ipEntry).some((ts) => ts.length > 0)
  if (!hasAnyTimestamps) {
    log.delete(ip)
  }

  return false
}

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (!LIMITS[pathname]) {
    return NextResponse.next()
  }

  const ip = getIp(request)
  if (!ip) {
    return NextResponse.next()
  }

  if (isRateLimited(ip, pathname)) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again in a minute.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/ai-joke', '/api/speak', '/api/custom-jokes'],
}

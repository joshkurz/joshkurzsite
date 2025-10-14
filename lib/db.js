import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { newDb } from 'pg-mem'
import { ensureFatherhoodSeed } from './jokesSeed.js'

const CONNECTION_ENV_VARS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'PG_CONNECTION_STRING',
  'SUPABASE_DB_URL',
  'SUPABASE_POSTGRES_URL'
]

export function buildAwsConnectionString(env = process.env) {
  const host = env.AWS_RDS_HOST || env.RDS_HOSTNAME
  const username = env.AWS_RDS_USERNAME || env.RDS_USERNAME
  const password = env.AWS_RDS_PASSWORD || env.RDS_PASSWORD
  const database = env.AWS_RDS_DATABASE || env.RDS_DB_NAME
  const port = env.AWS_RDS_PORT || env.RDS_PORT
  if (!host || !username || !database) {
    return null
  }

  const parsedPort = port ? Number.parseInt(port, 10) : NaN
  const finalPort = Number.isFinite(parsedPort) ? parsedPort : 5432
  const encodedUser = encodeURIComponent(username)
  let auth = encodedUser
  if (password !== undefined && password !== '') {
    auth += `:${encodeURIComponent(password)}`
  }

  const sslRaw = env.AWS_RDS_SSL ?? env.RDS_SSL
  let sslMode = null
  if (sslRaw === undefined || sslRaw === null || `${sslRaw}`.trim() === '') {
    sslMode = 'require'
  } else {
    const normalized = `${sslRaw}`.toLowerCase()
    if (normalized === 'false' || normalized === 'disable') {
      sslMode = 'disable'
    } else if (['allow', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(normalized)) {
      sslMode = normalized
    } else {
      sslMode = 'require'
    }
  }

  const query = new URLSearchParams()
  if (sslMode && sslMode !== 'disable') {
    query.set('sslmode', sslMode)
  }
  const queryString = query.toString()
  const portSegment = finalPort ? `:${finalPort}` : ''

  return `postgresql://${auth}@${host}${portSegment}/${database}${queryString ? `?${queryString}` : ''}`
}

const globalState = globalThis.__databaseState || {
  poolPromise: null,
  schemaPromise: null,
  isMock: false,
  memDb: null,
  connectionLogCount: 0
}

if (!globalThis.__databaseState) {
  globalThis.__databaseState = globalState
}

function resolveConnectionString() {
  for (const key of CONNECTION_ENV_VARS) {
    if (process.env[key]) {
      return process.env[key]
    }
  }

  const awsConnection = buildAwsConnectionString()
  if (awsConnection) {
    return awsConnection
  }

  return null
}

function shouldUseSsl(connectionString) {
  if (!connectionString) {
    return false
  }
  if (process.env.PGSSLMODE) {
    return process.env.PGSSLMODE.toLowerCase() !== 'disable'
  }
  if (process.env.POSTGRES_SSL === 'true') {
    return true
  }
  const normalized = connectionString.startsWith('postgres://')
    ? connectionString.replace('postgres://', 'postgresql://')
    : connectionString
  if (normalized.startsWith('postgresql://') && normalized.includes('vercel')) {
    return true
  }
  try {
    const url = new URL(normalized.startsWith('postgresql://') ? normalized : `postgresql://${normalized}`)
    if (url.hostname.endsWith('rds.amazonaws.com') || url.hostname.endsWith('rds.amazonaws.com.cn')) {
      return true
    }
  } catch (error) {
    // Ignore parsing errors and fall through to the default false
  }
  return false
}

function normalizeConnectionString(connectionString) {
  if (!connectionString) {
    return null
  }
  const value = `${connectionString}`.trim()
  if (value.startsWith('postgresql://')) {
    return value
  }
  if (value.startsWith('postgres://')) {
    return value.replace('postgres://', 'postgresql://')
  }
  return `postgresql://${value}`
}

function safeDecodeURIComponent(value) {
  if (value === undefined || value === null) {
    return value
  }
  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

export function sanitizeConnectionString(connectionString) {
  if (!connectionString) {
    return null
  }

  const normalized = normalizeConnectionString(connectionString)
  if (!normalized) {
    return null
  }

  try {
    // If the normalized string parses successfully, return the canonicalized href to ensure
    // reserved characters (like "@" or spaces) are encoded consistently.
    const canonical = new URL(normalized).href
    if (canonical !== normalized && process.env.NODE_ENV !== 'test') {
      console.log('[db] Normalized connection credentials to escape special characters.')
    }
    return canonical
  } catch (error) {
    // Continue and attempt to escape credentials that may contain reserved characters.
  }

  const protocolSeparatorIndex = normalized.indexOf('://')
  const authEndIndex = normalized.lastIndexOf('@')
  if (protocolSeparatorIndex === -1 || authEndIndex === -1 || authEndIndex <= protocolSeparatorIndex + 2) {
    return normalized
  }

  const prefix = normalized.slice(0, protocolSeparatorIndex + 3)
  const rawAuth = normalized.slice(protocolSeparatorIndex + 3, authEndIndex)
  const rest = normalized.slice(authEndIndex + 1)
  const colonIndex = rawAuth.indexOf(':')
  const rawUser = colonIndex === -1 ? rawAuth : rawAuth.slice(0, colonIndex)
  const rawPassword = colonIndex === -1 ? '' : rawAuth.slice(colonIndex + 1)

  const decodedUser = safeDecodeURIComponent(rawUser)
  const decodedPassword = safeDecodeURIComponent(rawPassword)
  const encodedUser = encodeURIComponent(decodedUser)
  const encodedPassword = rawPassword ? encodeURIComponent(decodedPassword) : ''
  const sanitizedAuth = encodedPassword ? `${encodedUser}:${encodedPassword}` : encodedUser
  const sanitized = `${prefix}${sanitizedAuth}@${rest}`

  try {
    new URL(sanitized)
    if (sanitized !== normalized && process.env.NODE_ENV !== 'test') {
      console.log('[db] Normalized connection credentials to escape special characters.')
    }
    return sanitized
  } catch (error) {
    return normalized
  }
}

function parseConnectionMetadata(connectionString) {
  const normalized = normalizeConnectionString(connectionString)
  if (!normalized) {
    return {}
  }
  try {
    const url = new URL(normalized)
    return {
      host: url.hostname || null,
      port: url.port || null,
      database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, '')) || null : null
    }
  } catch (error) {
    return {}
  }
}

function formatConnectionDescriptor(metadata = {}, sslEnabled) {
  const host = metadata.host || 'unknown-host'
  const database = metadata.database || 'unknown-database'
  const port = metadata.port || 'default'
  const ssl = sslEnabled ? 'enabled' : 'disabled'
  return `database "${database}" on ${host}:${port} (ssl: ${ssl})`
}

async function logTableSnapshot(pool, metadata, contextLabel) {
  if (!pool || typeof pool.query !== 'function') {
    return
  }
  const context = contextLabel ? ` ${contextLabel}` : ''
  const database = metadata?.database || 'unknown-database'
  try {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    const tables = rows.map((row) => row.table_name).join(', ') || '(none)'
    console.log(`[db] ${database} public tables${context}: ${tables}`)
  } catch (error) {
    console.error(`[db] Failed to enumerate tables for ${database}${context}: ${error.message}`)
  }
}

function installPoolLogging(pool, metadata, sslEnabled) {
  if (!pool || typeof pool.on !== 'function') {
    return
  }
  pool.on('connect', (client) => {
    globalState.connectionLogCount += 1
    const connectionId = globalState.connectionLogCount
    const host = metadata?.host || 'unknown-host'
    const database = metadata?.database || 'unknown-database'
    const port = metadata?.port || 'default'
    const pid = typeof client?.processID === 'number' ? client.processID : 'n/a'
    console.log(
      `[db] connection #${connectionId} established (pid ${pid}) for database "${database}" on ${host}:${port} (ssl: ${sslEnabled ? 'enabled' : 'disabled'})`
    )
    setTimeout(() => {
      client
        .query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
        )
        .then(({ rows }) => {
          const tables = rows.map((row) => row.table_name).join(', ') || '(none)'
          console.log(`[db] connection #${connectionId} public tables: ${tables}`)
        })
        .catch((error) => {
          console.error(`[db] connection #${connectionId} failed to list public tables: ${error.message}`)
        })
    }, 0)
  })

  pool.on('error', (error) => {
    const descriptor = formatConnectionDescriptor(metadata, sslEnabled)
    console.error(`[db] Pool error for ${descriptor}:`, error)
  })
}

function escapeIdentifier(identifier) {
  const value = `${identifier}`
  return `"${value.replace(/"/g, '""')}"`
}

async function ensureDatabaseExists(connectionString, metadata, ssl) {
  if (!connectionString || !metadata?.database) {
    return
  }

  const descriptor = formatConnectionDescriptor(metadata, Boolean(ssl))
  const testPool = new Pool({ connectionString, ssl })
  let missing = false
  try {
    const client = await testPool.connect()
    client.release()
    return
  } catch (error) {
    if (error?.code !== '3D000') {
      throw error
    }
    missing = true
    console.warn(`[db] Database "${metadata.database}" is missing for ${descriptor}; attempting to create it.`)
  } finally {
    await testPool.end().catch(() => {})
  }

  if (!missing) {
    return
  }

  let adminUrl
  try {
    adminUrl = new URL(normalizeConnectionString(connectionString))
  } catch (error) {
    console.error('[db] Unable to parse connection string for database creation:', error)
    throw error
  }

  const originalPath = adminUrl.pathname
  const candidateDatabases = ['postgres', 'template1']
  let creationError = null

  for (const candidate of candidateDatabases) {
    adminUrl.pathname = `/${candidate}`
    let adminPool
    try {
      adminPool = new Pool({ connectionString: adminUrl.toString(), ssl })
      await adminPool.query(`CREATE DATABASE ${escapeIdentifier(metadata.database)}`)
      console.log(
        `[db] Created database "${metadata.database}" for ${descriptor} using template database "${candidate}"`
      )
      creationError = null
      break
    } catch (error) {
      if (error?.code === '42P04') {
        console.log(`[db] Database "${metadata.database}" already exists for ${descriptor}`)
        creationError = null
        break
      }
      if (error?.code === '3D000') {
        console.warn(
          `[db] Template database "${candidate}" is missing while creating "${metadata.database}" for ${descriptor}`
        )
        creationError = error
        continue
      }
      console.error(`[db] Failed to create database "${metadata.database}" for ${descriptor}:`, error)
      creationError = error
      break
    } finally {
      if (adminPool) {
        await adminPool.end().catch(() => {})
      }
    }
  }

  adminUrl.pathname = originalPath

  if (creationError) {
    throw creationError
  }
}

async function createPool() {
  const rawConnectionString = resolveConnectionString()
  const connectionString = sanitizeConnectionString(rawConnectionString)
  if (connectionString) {
    const sslEnabled = shouldUseSsl(connectionString)
    const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined
    const metadata = parseConnectionMetadata(connectionString)
    await ensureDatabaseExists(connectionString, metadata, ssl)
    console.log(`[db] Using PostgreSQL ${formatConnectionDescriptor(metadata, sslEnabled)}`)
    const pool = new Pool({ connectionString, ssl })
    pool.__metadata = metadata
    installPoolLogging(pool, metadata, sslEnabled)
    return {
      pool,
      isMock: false,
      memDb: null
    }
  }

  const memDb = newDb({ autoCreateForeignKeyIndices: true })
  // Ensure timestamps use JS Date
  memDb.public.registerFunction({ name: 'now', returns: 'timestamp', implementation: () => new Date() })
  memDb.public.registerFunction({
    name: 'to_char',
    args: ['date', 'text'],
    returns: 'text',
    implementation: (value, format) => {
      if (!value) {
        return null
      }
      const date = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(date.getTime())) {
        return null
      }
      const iso = date.toISOString().slice(0, 10)
      if (!format || format.toUpperCase() === 'YYYY-MM-DD') {
        return iso
      }
      return iso
    }
  })
  const { Pool: MemPool } = memDb.adapters.createPg()
  console.log('[db] Using in-memory pg-mem database (no PostgreSQL connection string provided).')
  return {
    pool: new MemPool(),
    isMock: true,
    memDb
  }
}

async function ensureSchema(pool) {
  if (!globalState.schemaPromise) {
    globalState.schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS jokes (
          id TEXT PRIMARY KEY,
          source_id INTEGER,
          opener TEXT NOT NULL,
          response TEXT,
          text TEXT NOT NULL,
          author TEXT,
          source TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_jokes_source ON jokes(source)
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS joke_submissions (
          id TEXT PRIMARY KEY,
          joke_id TEXT,
          opener TEXT NOT NULL,
          response TEXT,
          author TEXT,
          status TEXT NOT NULL,
          reason TEXT,
          created_at TIMESTAMPTZ NOT NULL
        )
      `)

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_joke_submissions_status ON joke_submissions(status)
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS ratings (
          id TEXT PRIMARY KEY,
          joke_id TEXT NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          mode TEXT NOT NULL CHECK (mode IN ('daily', 'live')),
          date_key DATE,
          joke TEXT,
          author TEXT,
          submitted_at TIMESTAMPTZ NOT NULL
        )
      `)

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ratings_joke_mode ON ratings(joke_id, mode)
      `)

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ratings_date ON ratings(date_key)
      `)

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ratings_submitted_at ON ratings(submitted_at DESC)
      `)

      await ensureFatherhoodSeed((text, params) => pool.query(text, params))

      if (pool.__metadata) {
        await logTableSnapshot(pool, pool.__metadata, '(post-bootstrap)')
      }
    })()
  }
  return globalState.schemaPromise
}

export async function getDatabasePool() {
  if (!globalState.poolPromise) {
    globalState.poolPromise = (async () => {
      const { pool, isMock, memDb } = await createPool()
      globalState.isMock = isMock
      globalState.memDb = memDb
      await ensureSchema(pool)
      return pool
    })()
  }
  return globalState.poolPromise
}

export function isMockDatabase() {
  return globalState.isMock
}

export async function query(text, params = []) {
  const pool = await getDatabasePool()
  const normalizedText =
    typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '[non-string query]'
  const paramPreview = Array.isArray(params) && params.length > 0 ? ` | params: ${JSON.stringify(params)}` : ''
  if (process.env.DEBUG_DB_QUERIES === 'true' || process.env.NODE_ENV !== 'test') {
    console.log(`[db] Executing query: ${normalizedText}${paramPreview}`)
  }
  return pool.query(text, params)
}

export async function withTransaction(callback) {
  const pool = await getDatabasePool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function generateId(prefix) {
  return `${prefix}-${randomUUID()}`
}

export async function resetDatabase() {
  if (!isMockDatabase()) {
    throw new Error('resetDatabase can only be used with the in-memory database')
  }
  if (globalState.memDb) {
    globalState.memDb.public.none('TRUNCATE TABLE ratings')
    globalState.memDb.public.none('TRUNCATE TABLE joke_submissions')
    globalState.memDb.public.none('TRUNCATE TABLE jokes')
  }
  globalState.schemaPromise = null
  globalState.poolPromise = null
  globalState.isMock = false
  globalState.memDb = null
}

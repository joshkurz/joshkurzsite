import {
  buildAwsConnectionString,
  getDatabasePool,
  resetDatabase,
  isMockDatabase,
  sanitizeConnectionString
} from '../../lib/db'

afterEach(async () => {
  if (isMockDatabase()) {
    await resetDatabase()
  }
})

describe('buildAwsConnectionString', () => {
  it('returns null when required values are missing', () => {
    expect(buildAwsConnectionString({})).toBeNull()
    expect(
      buildAwsConnectionString({
        AWS_RDS_HOST: 'example.rds.amazonaws.com',
        AWS_RDS_USERNAME: 'user'
      })
    ).toBeNull()
  })

  it('creates a connection string using AWS specific variables', () => {
    const connection = buildAwsConnectionString({
      AWS_RDS_HOST: 'dadjokes.cluster-123456789012.us-east-1.rds.amazonaws.com',
      AWS_RDS_USERNAME: 'groan-master',
      AWS_RDS_PASSWORD: 'laugh til you drop',
      AWS_RDS_DATABASE: 'groans',
      AWS_RDS_PORT: '5432'
    })

    expect(connection).toBe(
      'postgresql://groan-master:laugh%20til%20you%20drop@dadjokes.cluster-123456789012.us-east-1.rds.amazonaws.com:5432/groans?sslmode=require'
    )
  })

  it('supports the legacy RDS_* environment variables and custom ssl mode', () => {
    const connection = buildAwsConnectionString({
      RDS_HOSTNAME: 'legacy.cluster-abcdef.us-west-2.rds.amazonaws.com',
      RDS_USERNAME: 'legacy-user',
      RDS_PASSWORD: 'legacy-password',
      RDS_DB_NAME: 'legacydb',
      RDS_PORT: '6543',
      RDS_SSL: 'disable'
    })

    expect(connection).toBe(
      'postgresql://legacy-user:legacy-password@legacy.cluster-abcdef.us-west-2.rds.amazonaws.com:6543/legacydb'
    )
  })

  it('creates the jokes table and seeds the fatherhood catalog on first connect', async () => {
    const pool = await getDatabasePool()
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM jokes WHERE source = 'fatherhood'`
    )

    expect(Number(result.rows[0].count)).toBeGreaterThan(0)
  })

  it('sanitizes connection strings that include reserved characters', () => {
    const raw = 'postgresql://awspostgres:)*j6Blw$u0P7J#WI8tAPZuCX<$-p@database-1.cluster.aws:5432/dadabase'
    const sanitized = sanitizeConnectionString(raw)

    expect(sanitized).toBe(
      'postgresql://awspostgres:)*j6Blw%24u0P7J%23WI8tAPZuCX%3C%24-p@database-1.cluster.aws:5432/dadabase'
    )
    expect(() => new URL(sanitized)).not.toThrow()
  })

  it('sanitizes credentials that contain an @ symbol', () => {
    const raw = 'postgresql://encuser:p@ssw@rd@db.example.com:5432/appdb'
    const sanitized = sanitizeConnectionString(raw)

    expect(sanitized).toBe('postgresql://encuser:p%40ssw%40rd@db.example.com:5432/appdb')
    expect(() => new URL(sanitized)).not.toThrow()
  })
})

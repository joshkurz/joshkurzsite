import path from 'node:path'
import { rm } from 'node:fs/promises'
import { createMocks } from 'node-mocks-http'

describe('POST /api/custom-jokes', () => {
  const cacheDir = path.join('/tmp', 'custom-jokes-api-cache')
  const storageDir = path.join('/tmp', 'custom-jokes-api-storage')

  async function prepareEnvironment() {
    jest.resetModules()
    delete globalThis.__customJokesState
    process.env.MOCK_OPENAI = 'true'
    process.env.CUSTOM_JOKES_CACHE_DIR = cacheDir
    process.env.CUSTOM_JOKES_STORAGE_DIR = storageDir
    process.env.CUSTOM_JOKES_TTL_MS = '0'
    await rm(cacheDir, { recursive: true, force: true })
    await rm(storageDir, { recursive: true, force: true })
  }

  beforeEach(async () => {
    await prepareEnvironment()
  })

  afterEach(async () => {
    try {
      const moduleRef = require('../../lib/customJokes.js')
      if (moduleRef?.clearCustomJokesCache) {
        moduleRef.clearCustomJokesCache()
      }
    } catch (error) {
      // ignore
    }
    delete process.env.MOCK_OPENAI
    delete process.env.CUSTOM_JOKES_CACHE_DIR
    delete process.env.CUSTOM_JOKES_STORAGE_DIR
    delete process.env.CUSTOM_JOKES_TTL_MS
    delete globalThis.__customJokesState
    await rm(cacheDir, { recursive: true, force: true })
    await rm(storageDir, { recursive: true, force: true })
  })

  it('accepts a family-friendly submission', async () => {
    const handler = require('../../pages/api/custom-jokes').default
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        setup: 'Why did the coffee file a police report?',
        punchline: 'Because it got mugged!',
        author: 'Unit Tester'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    const payload = res._getJSONData()
    expect(payload.status).toBe('accepted')
    expect(payload.joke).toBeDefined()
    expect(payload.joke.author).toBe('Unit Tester')
  })

  it('rejects submissions flagged by the moderator', async () => {
    const handler = require('../../pages/api/custom-jokes').default
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        setup: 'This joke mentions explicit material',
        punchline: 'Definitely explicit content',
        author: 'Unit Tester'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const payload = res._getJSONData()
    expect(payload.status).toBe('rejected')
    expect(payload.reason).toMatch(/inappropriate/i)
  })

  it('validates required fields', async () => {
    const handler = require('../../pages/api/custom-jokes').default
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        setup: 'Hello there',
        punchline: '',
        author: 'Tester'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const payload = res._getJSONData()
    expect(payload.error).toMatch(/Punchline/)
  })
})

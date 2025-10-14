import { jest } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

async function loadHandler() {
  jest.resetModules()
  delete globalThis.__databaseState
  return (await import('../../pages/api/custom-jokes')).default
}

describe('POST /api/custom-jokes', () => {
  beforeEach(() => {
    process.env.MOCK_OPENAI = 'true'
  })

  afterEach(() => {
    delete process.env.MOCK_OPENAI
    delete globalThis.__databaseState
  })

  it('accepts a family-friendly submission', async () => {
    const handler = await loadHandler()
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
    const handler = await loadHandler()
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
    const handler = await loadHandler()
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

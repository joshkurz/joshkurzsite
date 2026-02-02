const mockSend = jest.fn()

jest.mock('../../lib/dynamoClient.js', () => ({
  getDynamoClient: () => ({ send: mockSend }),
  RATINGS_TABLE: 'test-ratings-table',
  PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ type: 'Query', params }))
}))

import { createMocks } from 'node-mocks-http'

describe('POST /api/custom-jokes', () => {
  async function prepareEnvironment() {
    jest.resetModules()
    delete globalThis.__customJokesState
    process.env.MOCK_OPENAI = 'true'
  }

  beforeEach(async () => {
    mockSend.mockReset()
    mockSend.mockResolvedValue({ Items: [] })
    await prepareEnvironment()
  })

  afterEach(() => {
    try {
      const moduleRef = require('../../lib/customJokes.js')
      if (moduleRef?.clearCustomJokesCache) {
        moduleRef.clearCustomJokesCache()
      }
    } catch (error) {
      // ignore
    }
    delete process.env.MOCK_OPENAI
    delete globalThis.__customJokesState
  })

  it('accepts a family-friendly submission', async () => {
    mockSend.mockResolvedValue({}) // For the put command
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
    mockSend.mockResolvedValue({}) // For the put command
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

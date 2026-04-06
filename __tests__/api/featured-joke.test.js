const mockGetRandomTopJoke = jest.fn()

jest.mock('../../lib/ratingsStorageDynamo', () => ({
  getRandomTopJoke: mockGetRandomTopJoke
}))

import { createMocks } from 'node-mocks-http'

const SAMPLE_JOKE = {
  jokeId: 'joke-abc',
  opener: 'Why did the scarecrow win an award?',
  punchline: 'Because he was outstanding in his field!',
  author: 'Dad',
  totalRatings: 42,
  average: 4.8
}

beforeEach(() => {
  jest.resetModules()
  mockGetRandomTopJoke.mockResolvedValue(SAMPLE_JOKE)
})

describe('GET /api/featured-joke', () => {
  it('returns the featured joke', async () => {
    const handler = require('../../pages/api/featured-joke').default
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data.opener).toBe(SAMPLE_JOKE.opener)
    expect(data.punchline).toBe(SAMPLE_JOKE.punchline)
    expect(data.jokeId).toBe(SAMPLE_JOKE.jokeId)
    expect(data.totalRatings).toBe(42)
    expect(data.average).toBe(4.8)
  })

  it('returns 404 when no top joke is available', async () => {
    mockGetRandomTopJoke.mockResolvedValue(null)
    const handler = require('../../pages/api/featured-joke').default
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(404)
    expect(res._getJSONData()).toHaveProperty('error')
  })

  it('returns 500 when getRandomTopJoke throws', async () => {
    mockGetRandomTopJoke.mockRejectedValue(new Error('DynamoDB unavailable'))
    const handler = require('../../pages/api/featured-joke').default
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toHaveProperty('error')
  })
})

describe('non-GET /api/featured-joke', () => {
  it('returns 405 for POST', async () => {
    const handler = require('../../pages/api/featured-joke').default
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })

  it('returns 405 for DELETE', async () => {
    const handler = require('../../pages/api/featured-joke').default
    const { req, res } = createMocks({ method: 'DELETE' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })
})

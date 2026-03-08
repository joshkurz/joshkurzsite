const mockWriteRating = jest.fn()
const mockReadStats = jest.fn()

class MockAlreadyVotedError extends Error {
  constructor() {
    super('You have already rated this joke')
    this.name = 'AlreadyVotedError'
  }
}

jest.mock('../../lib/ratingsStorageDynamo', () => ({
  writeRating: mockWriteRating,
  readStats: mockReadStats,
  AlreadyVotedError: MockAlreadyVotedError
}))

import { createMocks } from 'node-mocks-http'

const DEFAULT_STATS = {
  counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  totalRatings: 0,
  average: 0,
  jokeId: 'joke-1'
}

describe('GET /api/ratings', () => {
  beforeEach(() => {
    jest.resetModules()
    mockReadStats.mockResolvedValue(DEFAULT_STATS)
  })

  it('returns stats for a valid jokeId', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'GET', query: { jokeId: 'joke-1' } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toMatchObject({ jokeId: 'joke-1' })
  })

  it('returns 400 for missing jokeId', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'GET', query: {} })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('returns 400 for jokeId that is too long', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'GET', query: { jokeId: 'x'.repeat(201) } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })
})

describe('POST /api/ratings', () => {
  beforeEach(() => {
    jest.resetModules()
    mockWriteRating.mockResolvedValue(DEFAULT_STATS)
  })

  it('saves a valid rating and returns stats', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({
      method: 'POST',
      body: { jokeId: 'joke-1', rating: 4 }
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(mockWriteRating).toHaveBeenCalledWith(
      expect.objectContaining({ jokeId: 'joke-1', rating: 4 })
    )
  })

  it('returns 422 for a rating below 1', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'POST', body: { jokeId: 'joke-1', rating: 0 } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(422)
  })

  it('returns 422 for a rating above 5', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'POST', body: { jokeId: 'joke-1', rating: 6 } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(422)
  })

  it('returns 422 for a non-integer rating', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'POST', body: { jokeId: 'joke-1', rating: 2.5 } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(422)
  })

  it('returns 400 for missing jokeId', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'POST', body: { rating: 3 } })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('returns 400 for joke text that is too long', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({
      method: 'POST',
      body: { jokeId: 'joke-1', rating: 3, joke: 'x'.repeat(1001) }
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('returns 400 for author that is too long', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({
      method: 'POST',
      body: { jokeId: 'joke-1', rating: 3, author: 'x'.repeat(201) }
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('returns 409 when AlreadyVotedError is thrown', async () => {
    mockWriteRating.mockRejectedValue(new MockAlreadyVotedError())
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({
      method: 'POST',
      body: { jokeId: 'joke-1', rating: 3 }
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(409)
    const payload = res._getJSONData()
    expect(payload.alreadyVoted).toBe(true)
    expect(payload.error).toMatch(/already rated/i)
  })
})

describe('unsupported methods', () => {
  it('returns 405 for PUT', async () => {
    const handler = require('../../pages/api/ratings').default
    const { req, res } = createMocks({ method: 'PUT' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })
})

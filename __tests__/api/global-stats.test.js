const mockReadGlobalStats = jest.fn()

jest.mock('../../lib/ratingsStorageDynamo', () => ({
  readGlobalStats: mockReadGlobalStats
}))

import { createMocks } from 'node-mocks-http'

beforeEach(() => {
  jest.resetModules()
  mockReadGlobalStats.mockResolvedValue({ totalRatings: 1234, overallAverage: 3.72 })
})

describe('GET /api/global-stats', () => {
  it('returns totalRatings and overallAverage', async () => {
    const handler = require('../../pages/api/global-stats').default
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data.totalRatings).toBe(1234)
    expect(data.overallAverage).toBe(3.72)
  })

  it('returns 200 with zeros when readGlobalStats throws', async () => {
    mockReadGlobalStats.mockRejectedValue(new Error('DynamoDB unavailable'))
    const handler = require('../../pages/api/global-stats').default
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    expect(data.totalRatings).toBe(0)
    expect(data.overallAverage).toBe(0)
  })
})

describe('non-GET /api/global-stats', () => {
  it('returns 405 for POST', async () => {
    const handler = require('../../pages/api/global-stats').default
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })

  it('returns 405 for DELETE', async () => {
    const handler = require('../../pages/api/global-stats').default
    const { req, res } = createMocks({ method: 'DELETE' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(405)
  })
})

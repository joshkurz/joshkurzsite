const mockSend = jest.fn()
const mockIsNsfw = jest.fn().mockReturnValue(false)
const mockFlagJokeAsNsfw = jest.fn().mockResolvedValue(undefined)

jest.mock('../../lib/dynamoClient.js', () => ({
  getDynamoClient: () => ({ send: mockSend }),
  RATINGS_TABLE: 'test-ratings-table',
  PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ type: 'Query', params }))
}))

jest.mock('../../lib/nsfwFilter', () => ({
  isNsfw: (...args) => mockIsNsfw(...args)
}))

jest.mock('../../lib/ratingsStorageDynamo', () => {
  const actual = jest.requireActual('../../lib/ratingsStorageDynamo')
  return {
    ...actual,
    flagJokeAsNsfw: (...args) => mockFlagJokeAsNsfw(...args)
  }
})

import handler from '../../pages/api/random-joke'
import { createMocks } from 'node-mocks-http'
import { getAllJokes } from '../../lib/jokesData'

describe('GET /api/random-joke', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockIsNsfw.mockReset()
    mockFlagJokeAsNsfw.mockReset()
    // Default: no voted IDs, no flagged IDs, all jokes clean
    mockSend.mockResolvedValue({ Items: [] })
    mockIsNsfw.mockReturnValue(false)
    mockFlagJokeAsNsfw.mockResolvedValue(undefined)
  })

  it('returns a joke from the dataset', async () => {
    const jokes = getAllJokes()
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const data = res._getJSONData()
    const found = jokes.find((joke) => joke.id === data.id)
    expect(found).toBeDefined()
    expect(data.text).toBe(found.text)
    expect(data.author).toBe(found.author)
  })

  it('skips an NSFW joke and returns the next clean one', async () => {
    // Flag only the first call to isNsfw
    let callCount = 0
    mockIsNsfw.mockImplementation(() => {
      callCount++
      return callCount === 1
    })

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().id).toBeDefined()
    expect(mockIsNsfw).toHaveBeenCalledTimes(2)
  })

  it('calls flagJokeAsNsfw for a detected NSFW joke', async () => {
    let callCount = 0
    mockIsNsfw.mockImplementation(() => {
      callCount++
      return callCount === 1
    })

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(mockFlagJokeAsNsfw).toHaveBeenCalledTimes(1)
  })

  it('excludes jokes whose IDs are in the NSFW flag list', async () => {
    const jokes = getAllJokes()
    const flaggedId = jokes[0].id
    mockSend
      .mockResolvedValueOnce({ Items: [] })                    // voted
      .mockResolvedValueOnce({ Items: [{ SK: flaggedId }] })  // flagged

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().id).not.toBe(flaggedId)
  })

  it('returns exhausted when all remaining candidates are NSFW', async () => {
    mockIsNsfw.mockReturnValue(true)

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData().exhausted).toBe(true)
  })
})

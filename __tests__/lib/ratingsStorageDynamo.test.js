const mockSend = jest.fn()

jest.mock('../../lib/dynamoClient.js', () => ({
  getDynamoClient: () => ({ send: mockSend }),
  RATINGS_TABLE: 'test-ratings-table',
  STATS_TABLE: 'test-stats-table',
  GetCommand: jest.fn().mockImplementation((params) => ({ type: 'Get', params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ type: 'Query', params })),
  PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', params })),
}))

import { readGlobalStats, getRandomTopJoke } from '../../lib/ratingsStorageDynamo.js'

beforeEach(() => {
  mockSend.mockReset()
})

// ─── readGlobalStats ──────────────────────────────────────────────────────────

describe('readGlobalStats', () => {
  it('returns totalRatings and overallAverage from the GLOBAL AGGREGATE item', async () => {
    mockSend.mockResolvedValue({
      Item: { totalRatings: 250, totalScore: 875, count1: 10, count2: 30, count3: 60, count4: 90, count5: 60 }
    })
    const result = await readGlobalStats()
    expect(result.totalRatings).toBe(250)
    expect(result.overallAverage).toBe(3.5)
  })

  it('returns zeros when the GLOBAL item does not exist yet', async () => {
    mockSend.mockResolvedValue({})
    const result = await readGlobalStats()
    expect(result.totalRatings).toBe(0)
    expect(result.overallAverage).toBe(0)
  })

  it('returns zero average when totalScore is missing', async () => {
    mockSend.mockResolvedValue({ Item: { totalRatings: 5 } })
    const result = await readGlobalStats()
    expect(result.overallAverage).toBe(0)
  })

  it('rounds overallAverage to two decimal places', async () => {
    mockSend.mockResolvedValue({ Item: { totalRatings: 3, totalScore: 10 } })
    const result = await readGlobalStats()
    expect(result.overallAverage).toBe(3.33)
  })
})

// ─── getRandomTopJoke ─────────────────────────────────────────────────────────

describe('getRandomTopJoke', () => {
  const makeItem = (overrides = {}) => ({
    PK: 'STATS#joke-abc',
    jokeText: 'Why did the scarecrow win an award? || Because he was outstanding in his field!',
    author: 'Dad',
    totalRatings: 5,
    GSI1SK: 4.8,
    ...overrides
  })

  it('returns a joke with opener and punchline split on " || "', async () => {
    mockSend.mockResolvedValue({ Items: [makeItem()], Count: 1 })
    const result = await getRandomTopJoke()
    expect(result).not.toBeNull()
    expect(result.opener).toBe('Why did the scarecrow win an award?')
    expect(result.punchline).toBe('Because he was outstanding in his field!')
    expect(result.jokeId).toBe('joke-abc')
    expect(result.author).toBe('Dad')
    expect(result.totalRatings).toBe(5)
    expect(result.average).toBe(4.8)
  })

  it('returns null when no items are returned', async () => {
    mockSend.mockResolvedValue({ Items: [], Count: 0 })
    const result = await getRandomTopJoke()
    expect(result).toBeNull()
  })

  it('returns null when all items are filtered out due to low vote count', async () => {
    mockSend.mockResolvedValue({
      Items: [makeItem({ totalRatings: 1 }), makeItem({ totalRatings: 2 })],
      Count: 2
    })
    const result = await getRandomTopJoke()
    expect(result).toBeNull()
  })

  it('returns null when all items have no jokeText', async () => {
    mockSend.mockResolvedValue({
      Items: [makeItem({ jokeText: null }), makeItem({ jokeText: '' })],
      Count: 2
    })
    const result = await getRandomTopJoke()
    expect(result).toBeNull()
  })

  it('handles a joke with no punchline separator', async () => {
    mockSend.mockResolvedValue({
      Items: [makeItem({ jokeText: 'Just a single line joke' })],
      Count: 1
    })
    const result = await getRandomTopJoke()
    expect(result.opener).toBe('Just a single line joke')
    expect(result.punchline).toBe('')
  })

  it('sets author to null when missing from item', async () => {
    mockSend.mockResolvedValue({
      Items: [makeItem({ author: undefined })],
      Count: 1
    })
    const result = await getRandomTopJoke()
    expect(result.author).toBeNull()
  })

  it('strips the STATS# prefix from jokeId', async () => {
    mockSend.mockResolvedValue({
      Items: [makeItem({ PK: 'STATS#custom-joke-999' })],
      Count: 1
    })
    const result = await getRandomTopJoke()
    expect(result.jokeId).toBe('custom-joke-999')
  })

  it('returns one of the eligible candidates at random', async () => {
    const items = [
      makeItem({ PK: 'STATS#joke-1', jokeText: 'Q1 || A1' }),
      makeItem({ PK: 'STATS#joke-2', jokeText: 'Q2 || A2' }),
      makeItem({ PK: 'STATS#joke-3', jokeText: 'Q3 || A3' }),
    ]
    mockSend.mockResolvedValue({ Items: items, Count: 3 })
    const ids = new Set()
    for (let i = 0; i < 30; i++) {
      const result = await getRandomTopJoke()
      ids.add(result.jokeId)
    }
    expect(ids.size).toBeGreaterThan(1)
  })
})

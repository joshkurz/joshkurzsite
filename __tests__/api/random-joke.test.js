const mockSend = jest.fn()

jest.mock('../../lib/dynamoClient.js', () => ({
  getDynamoClient: () => ({ send: mockSend }),
  RATINGS_TABLE: 'test-ratings-table',
  PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ type: 'Query', params }))
}))

import handler from '../../pages/api/random-joke'
import { createMocks } from 'node-mocks-http'
import { getAllJokes } from '../../lib/jokesData'

describe('GET /api/random-joke', () => {
  beforeEach(() => {
    mockSend.mockReset()
    // Mock empty custom jokes
    mockSend.mockResolvedValue({ Items: [] })
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
})

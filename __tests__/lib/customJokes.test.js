const mockSend = jest.fn()

jest.mock('../../lib/dynamoClient.js', () => ({
  getDynamoClient: () => ({ send: mockSend }),
  RATINGS_TABLE: 'test-ratings-table',
  PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ type: 'Query', params }))
}))

describe('custom jokes storage', () => {
  let customJokes

  async function loadModule() {
    jest.resetModules()
    delete globalThis.__customJokesState
    customJokes = await import('../../lib/customJokes.js')
  }

  beforeEach(async () => {
    mockSend.mockReset()
    // Mock empty initial query result
    mockSend.mockResolvedValue({ Items: [] })
    await loadModule()
  })

  afterEach(() => {
    if (customJokes?.clearCustomJokesCache) {
      customJokes.clearCustomJokesCache()
    }
    delete globalThis.__customJokesState
  })

  it('records accepted jokes and makes them available', async () => {
    // Mock the PutCommand to succeed
    mockSend.mockResolvedValueOnce({}) // For the put

    const saved = await customJokes.recordAcceptedJoke({
      opener: 'Why did the chicken cross the road?',
      response: 'To get to the other side!',
      author: 'Tester'
    })

    expect(saved.author).toBe('Tester')
    expect(saved.opener).toContain('chicken')

    // Verify DynamoDB was called with correct data
    expect(mockSend).toHaveBeenCalled()
    const putCall = mockSend.mock.calls.find(call => call[0]?.type === 'Put')
    expect(putCall).toBeDefined()
    expect(putCall[0].params.Item.author).toBe('Tester')
    expect(putCall[0].params.Item.status).toBe('accepted')
    expect(putCall[0].params.Item.GSI1PK).toBe('CUSTOM_JOKES_ACCEPTED')

    const jokes = customJokes.getCustomJokes()
    const found = jokes.find((joke) => joke.id === saved.id)
    expect(found).toBeDefined()
    expect(found.author).toBe('Tester')
  })

  it('records rejected jokes and stores them in DynamoDB with rejected status', async () => {
    // Mock the PutCommand to succeed
    mockSend.mockResolvedValueOnce({})

    const rejected = await customJokes.recordRejectedJoke({
      opener: 'inappropriate joke',
      response: 'not funny',
      author: 'Someone',
      reason: 'family friendly filter'
    })

    expect(rejected.id).toBeDefined()
    expect(rejected.reason).toContain('family friendly')

    // Verify rejected joke was stored with correct status in DynamoDB
    const putCall = mockSend.mock.calls.find(call => call[0]?.type === 'Put')
    expect(putCall).toBeDefined()
    expect(putCall[0].params.Item.status).toBe('rejected')
    expect(putCall[0].params.Item.GSI1PK).toBe('CUSTOM_JOKES_REJECTED')
    expect(putCall[0].params.Item.reason).toContain('family friendly')
  })

  it('loads accepted jokes from DynamoDB on initialization', async () => {
    // Reset and set up mock to return jokes
    mockSend.mockReset()
    mockSend.mockResolvedValue({
      Items: [
        {
          PK: 'CUSTOM_JOKE#custom-123',
          SK: 'METADATA',
          id: 'custom-123',
          opener: 'Test opener',
          response: 'Test response',
          author: 'Test Author',
          status: 'accepted',
          createdAt: '2024-01-01T00:00:00.000Z',
          GSI1PK: 'CUSTOM_JOKES_ACCEPTED',
          GSI1SK: '2024-01-01T00:00:00.000Z'
        }
      ]
    })

    // Reload module to trigger initialization
    await loadModule()
    const jokes = await customJokes.getCustomJokesAsync()

    expect(jokes.length).toBe(1)
    expect(jokes[0].opener).toBe('Test opener')
    expect(jokes[0].author).toBe('Test Author')
  })
})

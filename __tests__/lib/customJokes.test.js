import { jest } from '@jest/globals'

describe('custom jokes storage', () => {
  let customJokes
  let db

  async function loadModule() {
    jest.resetModules()
    delete globalThis.__databaseState
    customJokes = await import('../../lib/customJokes.js')
    db = await import('../../lib/db.js')
  }

  beforeEach(async () => {
    await loadModule()
    if (db.resetDatabase) {
      await db.resetDatabase().catch(() => {})
    }
    delete globalThis.__databaseState
    await loadModule()
  })

  afterEach(() => {
    delete globalThis.__databaseState
  })

  it('records accepted jokes and makes them available', async () => {
    const saved = await customJokes.recordAcceptedJoke({
      opener: 'Why did the chicken cross the road?',
      response: 'To get to the other side!',
      author: 'Tester'
    })

    expect(saved.author).toBe('Tester')
    expect(saved.opener).toContain('chicken')

    const jokes = await customJokes.getCustomJokes()
    const found = jokes.find((joke) => joke.id === saved.id)
    expect(found).toBeDefined()
    expect(found.author).toBe('Tester')
  })

  it('records rejected jokes without affecting accepted list', async () => {
    await customJokes.recordAcceptedJoke({
      opener: 'What do you call cheese that is not yours?',
      response: 'Nacho cheese!',
      author: 'Tester'
    })

    const before = await customJokes.getCustomJokes()

    const rejected = await customJokes.recordRejectedJoke({
      opener: 'inappropriate joke',
      response: 'not funny',
      author: 'Someone',
      reason: 'family friendly filter'
    })

    expect(rejected.id).toBeDefined()
    expect(rejected.reason).toContain('family friendly')

    const after = await customJokes.getCustomJokes()
    expect(after.length).toBe(before.length)
  })
})

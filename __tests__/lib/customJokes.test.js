import path from 'node:path'
import { rm } from 'node:fs/promises'

describe('custom jokes storage', () => {
  const cacheDir = path.join('/tmp', 'custom-jokes-test-cache')
  const storageDir = path.join('/tmp', 'custom-jokes-test-storage')
  let customJokes

  async function loadModule() {
    jest.resetModules()
    delete globalThis.__customJokesState
    process.env.CUSTOM_JOKES_CACHE_DIR = cacheDir
    process.env.CUSTOM_JOKES_STORAGE_DIR = storageDir
    process.env.CUSTOM_JOKES_TTL_MS = '0'
    customJokes = await import('../../lib/customJokes.js')
  }

  beforeEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
    await rm(storageDir, { recursive: true, force: true })
    await loadModule()
  })

  afterEach(async () => {
    if (customJokes?.clearCustomJokesCache) {
      customJokes.clearCustomJokesCache()
    }
    delete process.env.CUSTOM_JOKES_CACHE_DIR
    delete process.env.CUSTOM_JOKES_STORAGE_DIR
    delete process.env.CUSTOM_JOKES_TTL_MS
    delete globalThis.__customJokesState
    await rm(cacheDir, { recursive: true, force: true })
    await rm(storageDir, { recursive: true, force: true })
  })

  it('records accepted jokes and makes them available', async () => {
    const saved = await customJokes.recordAcceptedJoke({
      opener: 'Why did the chicken cross the road?',
      response: 'To get to the other side!',
      author: 'Tester'
    })

    expect(saved.author).toBe('Tester')
    expect(saved.opener).toContain('chicken')

    const jokes = customJokes.getCustomJokes()
    const found = jokes.find((joke) => joke.id === saved.id)
    expect(found).toBeDefined()
    expect(found.author).toBe('Tester')
  })

  it('records rejected jokes without affecting accepted cache', async () => {
    await customJokes.recordAcceptedJoke({
      opener: 'What do you call cheese that is not yours?',
      response: 'Nacho cheese!',
      author: 'Tester'
    })

    const beforeCount = customJokes.getCustomJokes().length

    const rejected = await customJokes.recordRejectedJoke({
      opener: 'inappropriate joke',
      response: 'not funny',
      author: 'Someone',
      reason: 'family friendly filter'
    })

    expect(rejected.id).toBeDefined()
    expect(rejected.reason).toContain('family friendly')

    const afterCount = customJokes.getCustomJokes().length
    expect(afterCount).toBe(beforeCount)
  })
})

import { jest } from '@jest/globals'

async function loadRatingsStorage() {
  jest.resetModules()
  delete globalThis.__databaseState
  return await import('../../lib/ratingsStorage')
}

describe('summarizeRatings', () => {
  afterEach(() => {
    delete globalThis.__databaseState
  })

  it('counts daily ratings without requiring date casts', async () => {
    const ratingsStorage = await loadRatingsStorage()

    await ratingsStorage.handleWriteReview({
      mode: 'daily',
      jokeId: '',
      dateKey: '2024-05-01',
      rating: 5,
      joke: 'Knock knock',
      author: 'Tester'
    })

    await ratingsStorage.handleWriteReview({
      mode: 'daily',
      jokeId: '',
      dateKey: '2024-05-01',
      rating: 3,
      joke: 'Who is there?',
      author: 'Tester'
    })

    const summary = await ratingsStorage.summarizeRatings()

    expect(summary.totals.overallRatings).toBe(2)
    expect(summary.totals.uniqueJokes).toBe(1)
    expect(summary.totals.overallAverage).toBe(4)
  })
})

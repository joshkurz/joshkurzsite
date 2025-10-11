import {
  summarizeTopRatedJokes,
  getInspirationPromptBlock,
  __resetInspirationForTests,
  __setInspirationCacheForTests
} from '../../lib/jokeInspiration.mjs';

afterEach(() => {
  __resetInspirationForTests();
});

describe('summarizeTopRatedJokes', () => {
  it('limits processing to the newest 100 entries and keeps only 4-5 star jokes', () => {
    const baseDate = new Date('2024-01-01T00:00:00Z');
    const entries = Array.from({ length: 120 }, (_, index) => {
      const submittedAt = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000).toISOString();
      const isFiveStar = index % 10 === 0;
      return {
        rating: isFiveStar ? 5 : 3,
        joke: `Question: Setup ${index}\nAnswer: Punchline ${index}`,
        submittedAt,
        jokeId: `joke-${index}`
      };
    });

    const summary = summarizeTopRatedJokes(entries);

    expect(summary.sampleSize).toBe(100);
    expect(summary.jokes).toHaveLength(10);
    summary.jokes.forEach((joke) => {
      expect(joke.averageRating).toBe(5);
      expect(joke.reviewCount).toBe(1);
    });
  });

  it('aggregates multiple positive ratings for the same joke and sorts by recency on ties', () => {
    const entries = [
      {
        rating: 5,
        joke: 'Question: Alpha?\nAnswer: Alpha!',
        submittedAt: '2024-01-03T00:00:00Z',
        jokeId: 'alpha'
      },
      {
        rating: 4,
        joke: 'Question: Alpha?\nAnswer: Alpha!',
        submittedAt: '2024-01-04T00:00:00Z',
        jokeId: 'alpha'
      },
      {
        rating: 4,
        joke: 'Question: Beta?\nAnswer: Beta!',
        submittedAt: '2024-01-01T00:00:00Z',
        jokeId: 'beta'
      },
      {
        rating: 5,
        joke: 'Question: Beta?\nAnswer: Beta!',
        submittedAt: '2024-01-05T00:00:00Z',
        jokeId: 'beta'
      },
      {
        rating: 5,
        joke: 'Question: Gamma?\nAnswer: Gamma!',
        submittedAt: '2024-01-02T00:00:00Z',
        jokeId: 'gamma'
      }
    ];

    const summary = summarizeTopRatedJokes(entries);

    expect(summary.sampleSize).toBe(entries.length);
    expect(summary.jokes).toHaveLength(3);
    const [first, second, third] = summary.jokes;
    expect(first.jokeId).toBe('gamma');
    expect(first.averageRating).toBe(5);
    expect(first.reviewCount).toBe(1);
    expect(second.jokeId).toBe('beta');
    expect(second.averageRating).toBe(4.5);
    expect(second.reviewCount).toBe(2);
    expect(third.jokeId).toBe('alpha');
  });
});

describe('getInspirationPromptBlock', () => {
  it('returns null when no jokes are cached', () => {
    const result = getInspirationPromptBlock();
    expect(result).toBeNull();
  });

  it('renders a prompt section with the cached jokes', () => {
    __setInspirationCacheForTests({
      sampleSize: 75,
      jokes: [
        { jokeId: 'a', joke: 'Question: A?\nAnswer: A!', reviewCount: 3, averageRating: 4.67 },
        { jokeId: 'b', joke: 'Question: B?\nAnswer: B!', reviewCount: 2, averageRating: 4.5 }
      ]
    });

    const block = getInspirationPromptBlock();

    expect(block).toContain('highest-rated jokes');
    expect(block).toContain('Question: A?');
    expect(block).toContain('4-5 stars');
    expect(block).toContain('internal plan');
  });
});

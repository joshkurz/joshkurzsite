import {
  getInspirationPromptBlock,
  __resetInspirationForTests,
  __setInspirationCacheForTests
} from '../../lib/jokeInspiration.mjs';

afterEach(() => {
  __resetInspirationForTests();
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

  it('limits prompt to 12 jokes when cache has more', () => {
    const manyJokes = Array.from({ length: 20 }, (_, i) => ({
      jokeId: `joke-${i}`,
      joke: `Question: Q${i}?\nAnswer: A${i}!`,
      reviewCount: 5,
      averageRating: 4.8
    }));
    __setInspirationCacheForTests({ sampleSize: 20, jokes: manyJokes });

    const block = getInspirationPromptBlock();

    // Should only include 12 jokes in the prompt
    const lines = block.split('\n').filter(l => /^\d+\./.test(l));
    expect(lines).toHaveLength(12);
  });
});

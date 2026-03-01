import { buildInspirationBlock } from '../../lib/jokeInspiration.mjs';

jest.mock('../../lib/ratingsStorageDynamo.js', () => ({
  getDashboardStats: jest.fn()
}));

import { getDashboardStats } from '../../lib/ratingsStorageDynamo.js';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildInspirationBlock', () => {
  it('returns null when there are no top performers', async () => {
    getDashboardStats.mockResolvedValue({ topPerformers: [] });
    const result = await buildInspirationBlock();
    expect(result).toBeNull();
  });

  it('returns null when getDashboardStats throws', async () => {
    getDashboardStats.mockRejectedValue(new Error('DynamoDB unavailable'));
    const result = await buildInspirationBlock();
    expect(result).toBeNull();
  });

  it('renders a prompt section with top performer jokes', async () => {
    getDashboardStats.mockResolvedValue({
      topPerformers: [
        { jokeId: 'a', joke: 'Question: A?\nAnswer: A!', totalRatings: 3, average: 4.67 },
        { jokeId: 'b', joke: 'Question: B?\nAnswer: B!', totalRatings: 2, average: 4.5 }
      ]
    });

    const block = await buildInspirationBlock();

    expect(block).toContain('highest-rated jokes');
    expect(block).toContain('Question: A?');
    expect(block).toContain('4-5 stars');
    expect(block).toContain('internal plan');
  });

  it('limits output to 12 jokes when more are available', async () => {
    const manyPerformers = Array.from({ length: 20 }, (_, i) => ({
      jokeId: `joke-${i}`,
      joke: `Question: Q${i}?\nAnswer: A${i}!`,
      totalRatings: 5,
      average: 4.8
    }));
    getDashboardStats.mockResolvedValue({ topPerformers: manyPerformers });

    const block = await buildInspirationBlock();

    const lines = block.split('\n').filter(l => /^\d+\./.test(l));
    expect(lines).toHaveLength(12);
  });
});

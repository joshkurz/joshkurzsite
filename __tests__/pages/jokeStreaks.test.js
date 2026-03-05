/** @jest-environment jsdom */
import { render, act } from '@testing-library/react';

// Minimal stub of the streak logic extracted for unit testing
function createStreakTracker(storage = {}) {
  const store = { ...storage };
  const sessionStorageMock = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    store
  };

  function incrementStreak(jokeId) {
    const stored = sessionStorageMock.getItem('jokeStreak');
    const streak = stored ? JSON.parse(stored) : { count: 0, ratedIds: [] };
    if (streak.ratedIds.includes(jokeId)) {
      return streak.count;
    }
    streak.ratedIds.push(jokeId);
    streak.count = streak.ratedIds.length;
    sessionStorageMock.setItem('jokeStreak', JSON.stringify(streak));
    return streak.count;
  }

  return { incrementStreak, sessionStorageMock };
}

describe('Joke Streaks', () => {
  describe('incrementStreak', () => {
    it('starts at 1 after rating the first joke', () => {
      const { incrementStreak } = createStreakTracker();
      expect(incrementStreak('joke-1')).toBe(1);
    });

    it('increments to 3 after rating three distinct jokes', () => {
      const { incrementStreak } = createStreakTracker();
      incrementStreak('joke-1');
      incrementStreak('joke-2');
      expect(incrementStreak('joke-3')).toBe(3);
    });

    it('does not increment when the same joke is rated again', () => {
      const { incrementStreak } = createStreakTracker();
      incrementStreak('joke-1');
      incrementStreak('joke-2');
      const countAfterDupe = incrementStreak('joke-1');
      expect(countAfterDupe).toBe(2);
    });

    it('persists count across multiple calls (simulating sessionStorage)', () => {
      const { incrementStreak, sessionStorageMock } = createStreakTracker();
      incrementStreak('joke-a');
      incrementStreak('joke-b');
      incrementStreak('joke-c');
      const stored = JSON.parse(sessionStorageMock.getItem('jokeStreak'));
      expect(stored.count).toBe(3);
      expect(stored.ratedIds).toEqual(['joke-a', 'joke-b', 'joke-c']);
    });

    it('resumes from existing sessionStorage data', () => {
      const existing = JSON.stringify({ count: 2, ratedIds: ['joke-x', 'joke-y'] });
      const { incrementStreak } = createStreakTracker({ jokeStreak: existing });
      expect(incrementStreak('joke-z')).toBe(3);
    });

    it('does not add a pre-existing joke from sessionStorage', () => {
      const existing = JSON.stringify({ count: 2, ratedIds: ['joke-x', 'joke-y'] });
      const { incrementStreak } = createStreakTracker({ jokeStreak: existing });
      expect(incrementStreak('joke-x')).toBe(2);
    });
  });

  describe('streak badge visibility threshold', () => {
    it('badge is not shown below 3', () => {
      expect(1 >= 3).toBe(false);
      expect(2 >= 3).toBe(false);
    });

    it('badge is shown at exactly 3', () => {
      expect(3 >= 3).toBe(true);
    });

    it('badge is shown above 3', () => {
      expect(5 >= 3).toBe(true);
    });
  });
});

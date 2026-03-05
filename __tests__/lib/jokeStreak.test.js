import { readStreak, incrementStreak } from '../../lib/jokeStreak';

// Provide a sessionStorage mock in the node test environment
let store = {};
const sessionStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { store = {}; }
};
global.sessionStorage = sessionStorageMock;

beforeEach(() => {
  store = {};
});

describe('readStreak', () => {
  it('returns 0 when no streak has been recorded', () => {
    expect(readStreak()).toBe(0);
  });

  it('returns the stored streak count', () => {
    sessionStorage.setItem('jokeStreak', '5');
    expect(readStreak()).toBe(5);
  });

  it('returns 0 when stored value is not a number', () => {
    sessionStorage.setItem('jokeStreak', 'bad');
    expect(readStreak()).toBe(0);
  });
});

describe('incrementStreak', () => {
  it('returns 1 on the first call', () => {
    expect(incrementStreak()).toBe(1);
  });

  it('persists the new streak count to sessionStorage', () => {
    incrementStreak();
    expect(sessionStorage.getItem('jokeStreak')).toBe('1');
  });

  it('increments an existing streak', () => {
    sessionStorage.setItem('jokeStreak', '4');
    expect(incrementStreak()).toBe(5);
    expect(sessionStorage.getItem('jokeStreak')).toBe('5');
  });

  it('reaches the streak threshold of 3 after three calls', () => {
    incrementStreak();
    incrementStreak();
    const third = incrementStreak();
    expect(third).toBeGreaterThanOrEqual(3);
  });
});

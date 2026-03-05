const STREAK_KEY = 'jokeStreak';

export function readStreak() {
  if (typeof sessionStorage === 'undefined') return 0;
  const n = parseInt(sessionStorage.getItem(STREAK_KEY) || '0', 10);
  return Number.isNaN(n) ? 0 : n;
}

export function incrementStreak() {
  const next = readStreak() + 1;
  sessionStorage.setItem(STREAK_KEY, String(next));
  return next;
}

import { readRecentRatingEntries } from './ratingsStorage.js';

const MAX_SAMPLED_JOKES = 100;
const MIN_SUCCESS_RATING = 4;
const MAX_JOKES_IN_PROMPT = 12;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const REFRESH_TIMER_SYMBOL = Symbol.for('jokeInspiration.refreshTimer');

function getGlobalObject() {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  return {};
}

let inspirationCache = {
  sampleSize: 0,
  jokes: []
};
let loadPromise = null;

function coerceTimestamp(value) {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatJokeForPrompt(joke, index) {
  const clean = joke.joke.replace(/\s+/g, ' ').trim();
  const ratingInfo = `avg ${joke.averageRating.toFixed(2)} stars across ${joke.reviewCount} votes`;
  return `${index + 1}. ${clean} (${ratingInfo})`;
}

export function summarizeTopRatedJokes(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { sampleSize: 0, jokes: [] };
  }

  const sanitized = entries
    .filter((entry) => entry && typeof entry.joke === 'string' && entry.joke.trim().length > 0)
    .sort((a, b) => coerceTimestamp(b.submittedAt) - coerceTimestamp(a.submittedAt));

  const limited = sanitized.slice(0, MAX_SAMPLED_JOKES);

  const jokesById = new Map();

  for (const entry of limited) {
    const rating = Number(entry.rating);
    if (!Number.isFinite(rating) || rating < MIN_SUCCESS_RATING) {
      continue;
    }
    const jokeText = entry.joke.trim();
    if (!jokeText) {
      continue;
    }
    const key = entry.jokeId || jokeText;
    if (!jokesById.has(key)) {
      jokesById.set(key, {
        jokeId: entry.jokeId || null,
        joke: jokeText,
        ratings: [],
        totalScore: 0,
        firstSeen: entry.submittedAt || null,
        lastSeen: entry.submittedAt || null
      });
    }
    const stats = jokesById.get(key);
    stats.ratings.push(rating);
    stats.totalScore += rating;
    const submittedTime = coerceTimestamp(entry.submittedAt);
    if (submittedTime) {
      if (!stats.firstSeen || submittedTime < coerceTimestamp(stats.firstSeen)) {
        stats.firstSeen = entry.submittedAt;
      }
      if (!stats.lastSeen || submittedTime > coerceTimestamp(stats.lastSeen)) {
        stats.lastSeen = entry.submittedAt;
      }
    }
  }

  const jokes = Array.from(jokesById.values())
    .map((item) => {
      const reviewCount = item.ratings.length;
      if (reviewCount === 0) {
        return null;
      }
      const averageRating = Number((item.totalScore / reviewCount).toFixed(2));
      return {
        jokeId: item.jokeId,
        joke: item.joke,
        reviewCount,
        averageRating,
        bestRating: Math.max(...item.ratings),
        firstSeen: item.firstSeen,
        lastSeen: item.lastSeen
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.averageRating === a.averageRating) {
        if (b.reviewCount === a.reviewCount) {
          return coerceTimestamp(b.lastSeen) - coerceTimestamp(a.lastSeen);
        }
        return b.reviewCount - a.reviewCount;
      }
      return b.averageRating - a.averageRating;
    });

  return {
    sampleSize: limited.length,
    jokes
  };
}

async function loadInspiration() {
  try {
    const entries = await readRecentRatingEntries(600);
    inspirationCache = summarizeTopRatedJokes(entries);
  } catch (error) {
    console.error('[joke-inspiration] Unable to preload rated jokes', error);
    inspirationCache = { sampleSize: 0, jokes: [] };
  }
  return inspirationCache;
}

function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = loadInspiration().catch((error) => {
      console.error('[joke-inspiration] Failed to load inspiration data', error);
      inspirationCache = { sampleSize: 0, jokes: [] };
      return inspirationCache;
    });
  }
  return loadPromise;
}

ensureLoaded();

function startBackgroundRefresh() {
  const globalObject = getGlobalObject();
  if (globalObject[REFRESH_TIMER_SYMBOL]) {
    return;
  }

  const timer = setInterval(() => {
    loadInspiration().catch((error) => {
      console.error('[joke-inspiration] Background refresh failed', error);
    });
  }, REFRESH_INTERVAL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  globalObject[REFRESH_TIMER_SYMBOL] = timer;
}

startBackgroundRefresh();

export function getInspirationSummary() {
  return inspirationCache;
}

export function getInspirationPromptBlock() {
  if (!inspirationCache.jokes.length) {
    return null;
  }
  const jokesForPrompt = inspirationCache.jokes.slice(0, MAX_JOKES_IN_PROMPT);
  const sampleDescriptor = inspirationCache.sampleSize >= MAX_SAMPLED_JOKES
    ? `${MAX_SAMPLED_JOKES} latest reviews`
    : `${inspirationCache.sampleSize} recent reviews`;
  const listHeader = `Here are ${jokesForPrompt.length} of the ${inspirationCache.jokes.length} highest-rated jokes (4-5 stars) sampled from ${sampleDescriptor} (we review at most ${MAX_SAMPLED_JOKES} per load):`;
  const bulletList = jokesForPrompt.map((joke, index) => formatJokeForPrompt(joke, index)).join('\n');
  return [
    listHeader,
    bulletList,
    'Study their shared tone, structure, pacing, and wordplay. Summarize the common style in a short internal plan before you write the new joke. Do not output the summary—only use it to inspire the final joke.',
    'Use that internal summary to craft a fresh two-line dad joke that feels like it belongs in this winning set while remaining original.'
  ].join('\n');
}

export function __resetInspirationForTests() {
  inspirationCache = { sampleSize: 0, jokes: [] };
  loadPromise = null;
  const globalObject = getGlobalObject();
  const timer = globalObject[REFRESH_TIMER_SYMBOL];
  if (timer) {
    clearInterval(timer);
  }
  delete globalObject[REFRESH_TIMER_SYMBOL];
}

export function __setInspirationCacheForTests(value) {
  inspirationCache = value;
}

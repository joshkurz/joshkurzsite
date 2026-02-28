import { getDashboardStats } from './ratingsStorageDynamo.js';

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

function formatJokeForPrompt(joke, index) {
  const clean = joke.joke.replace(/\s+/g, ' ').trim();
  const ratingInfo = `avg ${joke.averageRating.toFixed(2)} stars across ${joke.reviewCount} votes`;
  return `${index + 1}. ${clean} (${ratingInfo})`;
}

async function loadInspiration() {
  try {
    const { topPerformers } = await getDashboardStats();
    inspirationCache = {
      sampleSize: topPerformers.length,
      jokes: topPerformers.map(p => ({
        jokeId: p.jokeId,
        joke: p.joke,
        reviewCount: p.totalRatings,
        averageRating: p.average
      }))
    };
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
  const sampleDescriptor = `${inspirationCache.sampleSize} top-rated jokes`;
  const listHeader = `Here are ${jokesForPrompt.length} of the highest-rated jokes (4-5 stars) from ${sampleDescriptor}:`;
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

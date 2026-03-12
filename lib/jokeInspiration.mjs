import { getDashboardStats } from './ratingsStorageDynamo.js';
import { getCustomJokesAsync } from './customJokes.js';

const MAX_RECENT_AI_SETUPS = 20;

export async function getRecentAiJokeSetups() {
  try {
    const jokes = await getCustomJokesAsync();
    return jokes
      .slice(0, MAX_RECENT_AI_SETUPS)
      .map((j) => j.opener)
      .filter(Boolean);
  } catch (error) {
    console.error('[joke-inspiration] Failed to load recent AI jokes', error);
    return [];
  }
}

const MAX_JOKES_IN_PROMPT = 12;

function formatJokeForPrompt(joke, index) {
  const clean = joke.joke.replace(/\s+/g, ' ').trim();
  const ratingInfo = `avg ${joke.averageRating.toFixed(2)} stars across ${joke.reviewCount} votes`;
  return `${index + 1}. ${clean} (${ratingInfo})`;
}

export async function buildInspirationBlock() {
  try {
    const { topPerformers } = await getDashboardStats();
    if (!topPerformers.length) return null;

    const selected = topPerformers.slice(0, MAX_JOKES_IN_PROMPT);
    const jokes = selected.map((p, i) =>
      formatJokeForPrompt({ joke: p.joke, reviewCount: p.totalRatings, averageRating: p.average }, i)
    );

    // Extract just the setup lines so Claude can explicitly avoid them
    const setups = selected
      .map((p) => {
        const text = p.joke.replace(/\s+/g, ' ').trim();
        const firstLine = text.split(/[?\n]/)[0].trim();
        return `- "${firstLine}${text.includes('?') ? '?' : ''}"`
      })
      .join('\n');

    const sampleDescriptor = `${topPerformers.length} top-rated jokes`;
    return [
      `Here are ${jokes.length} of the highest-rated jokes (4-5 stars) from ${sampleDescriptor}:`,
      jokes.join('\n'),
      'Study their shared tone, structure, pacing, and wordplay. Summarize the common style in a short internal plan before you write the new joke. Do not output the summary—only use it to inspire the final joke.',
      `FORBIDDEN — you must not write a joke that uses any of these setups or is recognizably similar to them:\n${setups}`,
      'Write a completely original joke with a different setup, topic, and wordplay mechanism.'
    ].join('\n');
  } catch (error) {
    console.error('[joke-inspiration] Failed to load rated jokes', error);
    return null;
  }
}

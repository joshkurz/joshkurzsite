import { getDashboardStats } from './ratingsStorageDynamo.js';

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

    const jokes = topPerformers.slice(0, MAX_JOKES_IN_PROMPT).map((p, i) =>
      formatJokeForPrompt({ joke: p.joke, reviewCount: p.totalRatings, averageRating: p.average }, i)
    );

    const sampleDescriptor = `${topPerformers.length} top-rated jokes`;
    return [
      `Here are ${jokes.length} of the highest-rated jokes (4-5 stars) from ${sampleDescriptor}:`,
      jokes.join('\n'),
      'Study their shared tone, structure, pacing, and wordplay. Summarize the common style in a short internal plan before you write the new joke. Do not output the summary—only use it to inspire the final joke.',
      'Use that internal summary to craft a fresh joke that feels like it belongs in this winning set while remaining original.'
    ].join('\n');
  } catch (error) {
    console.error('[joke-inspiration] Failed to load rated jokes', error);
    return null;
  }
}

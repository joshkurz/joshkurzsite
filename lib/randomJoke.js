import { getAllJokesAsync } from './jokesData'
import { getVotedJokeIds, getFlaggedJokeIds, flagJokeAsNsfw, getLowRatedJokeIds } from './ratingsStorageDynamo'
import { isNsfw } from './nsfwFilter'

export const EXHAUSTED_MESSAGE =
  "You've rated every joke in our collection! I'd tell you another one, but I'm afraid I'm all out of material... get it? Because you've gone through all our material? Anyway, thanks for your tremendous contribution to dad joke science!"

// Group jokes by source, pick a random source, then a random joke from that source.
// Custom jokes (many individual authors) are treated as one "community" bucket so
// prolific submitters don't crowd out the curated sources.
function getSourceKey(joke) {
  return joke.id?.startsWith('custom-') ? 'community' : (joke.author || 'unknown')
}

function pickFairJoke(jokes) {
  const bySource = {}
  for (const joke of jokes) {
    const key = getSourceKey(joke)
    if (!bySource[key]) bySource[key] = []
    bySource[key].push(joke)
  }
  const sources = Object.keys(bySource)
  const source = sources[Math.floor(Math.random() * sources.length)]
  const pool = bySource[source]
  return pool[Math.floor(Math.random() * pool.length)]
}

export function getRequestIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    null
  )
}

// Picks a joke, excluding ones this IP already voted on, flagged jokes, and
// low-rated jokes — silently skipping (and flagging) any NSFW content.
export async function pickRandomJoke(ip) {
  const [allJokes, votedIds, flaggedIds, lowRatedIds] = await Promise.all([
    getAllJokesAsync(),
    getVotedJokeIds(ip),
    getFlaggedJokeIds(),
    getLowRatedJokeIds(1.5, 3)
  ])

  const excluded = new Set([...votedIds, ...flaggedIds, ...lowRatedIds])
  let candidates = excluded.size > 0
    ? allJokes.filter((j) => !excluded.has(j.id))
    : allJokes.slice()

  if (candidates.length === 0) {
    return { exhausted: true, message: EXHAUSTED_MESSAGE }
  }

  let joke = null
  while (candidates.length > 0) {
    const pick = pickFairJoke(candidates)
    if (isNsfw(pick.text)) {
      flagJokeAsNsfw(pick.id, pick.text, pick.author).catch(() => {})
      candidates = candidates.filter((c) => c.id !== pick.id)
      continue
    }
    joke = pick
    break
  }

  if (!joke) {
    return { exhausted: true, message: EXHAUSTED_MESSAGE }
  }

  return {
    id: joke.id,
    opener: joke.opener,
    response: joke.response,
    text: joke.text,
    author: joke.author || null
  }
}

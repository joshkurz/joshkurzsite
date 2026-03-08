import { getAllJokesAsync } from '../../lib/jokesData'
import { getVotedJokeIds } from '../../lib/ratingsStorageDynamo'

const EXHAUSTED_MESSAGE =
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

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    null
  )
}

export default async function handler(req, res) {
  try {
    const ip = getIp(req)
    const [allJokes, votedIds] = await Promise.all([
      getAllJokesAsync(),
      getVotedJokeIds(ip)
    ])

    const available = votedIds.size > 0
      ? allJokes.filter((j) => !votedIds.has(j.id))
      : allJokes

    if (available.length === 0) {
      return res.status(200).json({ exhausted: true, message: EXHAUSTED_MESSAGE })
    }

    const joke = pickFairJoke(available)
    res.status(200).json({
      id: joke.id,
      opener: joke.opener,
      response: joke.response,
      text: joke.text,
      author: joke.author || null
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load a dad joke' })
  }
}

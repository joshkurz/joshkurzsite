// pages/api/author-jokes.js
import { getDynamoClient, RATINGS_TABLE, STATS_TABLE, QueryCommand } from '../../lib/dynamoClient.js'
import { getAllJokes } from '../../lib/jokesData.js'

// Helper to create a jokeId from text (same logic as homepage)
function createJokeId(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return `joke-${Math.abs(hash)}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { author } = req.query

  if (!author) {
    return res.status(400).json({ error: 'Author parameter is required' })
  }

  try {
    const client = getDynamoClient()

    // Query all ratings for this author using GSI2
    const ratingsResult = await client.send(new QueryCommand({
      TableName: RATINGS_TABLE,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `AUTHOR#${author}` },
      ScanIndexForward: false
    }))

    // Group ratings by joke and calculate stats
    const jokeMap = new Map()
    for (const item of ratingsResult.Items || []) {
      const jokeId = item.PK.replace('JOKE#', '')
      if (!jokeMap.has(jokeId)) {
        jokeMap.set(jokeId, {
          jokeId,
          joke: item.jokeText,
          author: item.author,
          ratings: [],
          totalScore: 0,
          count: 0
        })
      }
      const jokeData = jokeMap.get(jokeId)
      jokeData.ratings.push(item.rating)
      jokeData.totalScore += item.rating
      jokeData.count += 1
    }

    // Convert to array and calculate averages
    const jokes = Array.from(jokeMap.values()).map(joke => ({
      jokeId: joke.jokeId,
      joke: joke.joke,
      author: joke.author,
      totalRatings: joke.count,
      average: joke.count > 0 ? Number((joke.totalScore / joke.count).toFixed(2)) : 0
    }))

    // Sort by average rating descending, then by total ratings
    jokes.sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average
      return b.totalRatings - a.totalRatings
    })

    // Add rank to each joke
    const rankedJokes = jokes.map((joke, index) => ({
      ...joke,
      rank: index + 1
    }))

    // Get all jokes for this author to find unrated ones
    const ratedJokeIds = new Set(jokeMap.keys())
    const allJokesForAuthor = getAllJokes().filter(j => {
      const jokeAuthor = (j.author || '').toLowerCase()
      const queryAuthor = author.toLowerCase()
      return jokeAuthor === queryAuthor ||
             jokeAuthor.includes(queryAuthor) ||
             queryAuthor.includes(jokeAuthor)
    })

    // Find unrated jokes
    const unratedJokes = allJokesForAuthor
      .map(j => {
        const jokeId = j.id || createJokeId(j.text)
        return {
          jokeId,
          joke: j.text,
          author: j.author
        }
      })
      .filter(j => !ratedJokeIds.has(j.jokeId))

    // Get author overall stats from global stats
    const authorStatsResult = await client.send(new QueryCommand({
      TableName: STATS_TABLE,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'GLOBAL',
        ':sk': `AUTHOR#${author}`
      }
    }))

    const authorStats = authorStatsResult.Items?.[0] || {}
    const totalRatings = authorStats.totalRatings || jokes.reduce((sum, j) => sum + j.totalRatings, 0)
    const overallAverage = authorStats.totalScore && authorStats.totalRatings
      ? Number((authorStats.totalScore / authorStats.totalRatings).toFixed(2))
      : jokes.length > 0
        ? Number((jokes.reduce((sum, j) => sum + j.average * j.totalRatings, 0) / totalRatings).toFixed(2))
        : 0

    res.status(200).json({
      author,
      totalJokes: rankedJokes.length + unratedJokes.length,
      totalRatings,
      overallAverage,
      jokes: rankedJokes,
      unratedJokes
    })
  } catch (error) {
    console.error('[author-jokes] Error:', error)
    res.status(500).json({ error: 'Failed to fetch author jokes' })
  }
}

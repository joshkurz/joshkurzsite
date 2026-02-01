// lib/ratingsStorageDynamo.js
import { randomUUID } from 'node:crypto';
import { getDynamoClient, RATINGS_TABLE, STATS_TABLE, PutCommand, GetCommand, QueryCommand } from './dynamoClient.js';

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

// O(1) write - just insert the rating record
export async function writeRating({ jokeId, rating, joke, author, mode, dateKey }) {
  const client = getDynamoClient();
  const submittedAt = new Date().toISOString();
  const uuid = randomUUID();

  await client.send(new PutCommand({
    TableName: RATINGS_TABLE,
    Item: {
      PK: `JOKE#${jokeId}`,
      SK: `RATING#${submittedAt}#${uuid}`,
      rating,
      jokeText: joke || null,
      author: author || 'Unknown',
      mode: mode || 'live',
      date: dateKey || submittedAt.slice(0, 10),
      submittedAt,
      GSI1PK: 'ALL_RATINGS',
      GSI1SK: submittedAt,
      GSI2PK: `AUTHOR#${author || 'Unknown'}`,
      GSI2SK: submittedAt
    }
  }));

  // Stats are updated async via DynamoDB Streams + Lambda
  // Return current stats immediately (eventually consistent)
  return readStats({ jokeId });
}

// O(1) read - single GetItem for pre-computed stats
export async function readStats({ jokeId }) {
  const client = getDynamoClient();

  const result = await client.send(new GetCommand({
    TableName: STATS_TABLE,
    Key: { PK: `STATS#${jokeId}`, SK: 'AGGREGATE' }
  }));

  if (!result.Item) {
    return {
      counts: { ...DEFAULT_COUNTS },
      totalRatings: 0,
      average: 0,
      ratings: [],
      jokeId
    };
  }

  const item = result.Item;
  return {
    counts: {
      1: item.count1 || 0,
      2: item.count2 || 0,
      3: item.count3 || 0,
      4: item.count4 || 0,
      5: item.count5 || 0
    },
    totalRatings: item.totalRatings || 0,
    average: item.totalScore && item.totalRatings
      ? Number((item.totalScore / item.totalRatings).toFixed(2))
      : 0,
    jokeId,
    lastRatedAt: item.lastRatedAt || null
  };
}

// O(1) read for dashboard - pre-computed global stats
export async function getDashboardStats() {
  const client = getDynamoClient();

  // Parallel queries for global stats, author stats, and top performers
  const [globalResult, authorsResult, topPerformersResult, recentResult] = await Promise.all([
    // Global aggregate
    client.send(new GetCommand({
      TableName: STATS_TABLE,
      Key: { PK: 'GLOBAL', SK: 'AGGREGATE' }
    })),

    // Author stats (query all AUTHOR# sort keys)
    client.send(new QueryCommand({
      TableName: STATS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'GLOBAL',
        ':sk': 'AUTHOR#'
      }
    })),

    // Top performers (from GSI, sorted by average rating)
    client.send(new QueryCommand({
      TableName: STATS_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'TOP_PERFORMERS' },
      ScanIndexForward: false,  // Descending by average
      Limit: 8
    })),

    // Recent ratings (from GSI on JokeRatings table)
    client.send(new QueryCommand({
      TableName: RATINGS_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'ALL_RATINGS' },
      ScanIndexForward: false,
      Limit: 20
    }))
  ]);

  const global = globalResult.Item || {};
  const authors = (authorsResult.Items || []).map(item => ({
    author: item.author || item.SK.replace('AUTHOR#', ''),
    totalRatings: item.totalRatings || 0,
    average: item.totalScore && item.totalRatings
      ? Number((item.totalScore / item.totalRatings).toFixed(2))
      : 0,
    ratingCounts: {
      1: item.count1 || 0, 2: item.count2 || 0, 3: item.count3 || 0,
      4: item.count4 || 0, 5: item.count5 || 0
    }
  })).sort((a, b) => b.totalRatings - a.totalRatings);

  const topPerformers = (topPerformersResult.Items || [])
    .filter(item => (item.totalRatings || 0) >= 3)
    .map(item => ({
      jokeId: item.PK.replace('STATS#', ''),
      joke: item.jokeText,
      author: item.author,
      totalRatings: item.totalRatings || 0,
      average: item.GSI1SK || 0,
      lastRatedAt: item.lastRatedAt
    }));

  const recentRatings = (recentResult.Items || []).map(item => ({
    jokeId: item.PK.replace('JOKE#', ''),
    rating: item.rating,
    joke: item.jokeText,
    author: item.author,
    mode: item.mode,
    date: item.date,
    submittedAt: item.submittedAt
  }));

  return {
    totals: {
      overallRatings: global.totalRatings || 0,
      overallAverage: global.totalScore && global.totalRatings
        ? Number((global.totalScore / global.totalRatings).toFixed(2))
        : 0,
      uniqueJokes: topPerformersResult.Count || 0,
      ratingCounts: {
        1: global.count1 || 0, 2: global.count2 || 0, 3: global.count3 || 0,
        4: global.count4 || 0, 5: global.count5 || 0
      },
      byAuthor: authors.map(({ ratingCounts, ...rest }) => rest)
    },
    ratingDistribution: {
      overall: {
        1: global.count1 || 0, 2: global.count2 || 0, 3: global.count3 || 0,
        4: global.count4 || 0, 5: global.count5 || 0
      },
      byAuthor: authors.reduce((acc, a) => ({ ...acc, [a.author]: a.ratingCounts }), {})
    },
    topPerformers,
    recentRatings
  };
}

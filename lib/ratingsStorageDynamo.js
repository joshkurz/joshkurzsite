// lib/ratingsStorageDynamo.js
import { randomUUID } from 'node:crypto';
import { getDynamoClient, RATINGS_TABLE, STATS_TABLE, PutCommand, GetCommand, QueryCommand } from './dynamoClient.js';

export class AlreadyVotedError extends Error {
  constructor() {
    super('You have already rated this joke');
    this.name = 'AlreadyVotedError';
  }
}

export async function getVotedJokeIds(ip) {
  if (!ip) return new Set();
  try {
    const client = getDynamoClient();
    const result = await client.send(new QueryCommand({
      TableName: RATINGS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `VOTER#${ip}`,
        ':prefix': 'VOTED#'
      },
      ProjectionExpression: 'SK'
    }));
    return new Set((result.Items || []).map(item => item.SK.slice('VOTED#'.length)));
  } catch (error) {
    console.error('[ratings] Failed to read voter history, failing open', { ip, error });
    return new Set();
  }
}

async function markVoted(ip, jokeId) {
  try {
    const client = getDynamoClient();
    await client.send(new PutCommand({
      TableName: RATINGS_TABLE,
      Item: { PK: `VOTER#${ip}`, SK: `VOTED#${jokeId}` }
    }));
  } catch (error) {
    console.error('[ratings] Failed to record voter history', { ip, jokeId, error });
  }
}

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

// O(1) write - just insert the rating record
export async function writeRating({ jokeId, rating, joke, author, mode, dateKey, ip }) {
  if (ip) {
    const client = getDynamoClient();
    const existing = await client.send(new GetCommand({
      TableName: RATINGS_TABLE,
      Key: { PK: `VOTER#${ip}`, SK: `VOTED#${jokeId}` }
    }));
    if (existing.Item) {
      throw new AlreadyVotedError();
    }
  }

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

  if (ip) {
    await markVoted(ip, jokeId);
  }

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

// ─── Shared internal helpers ──────────────────────────────────────────────────

// Fetches the raw GLOBAL AGGREGATE item from STATS_TABLE
async function readGlobalItem(client) {
  const result = await client.send(new GetCommand({
    TableName: STATS_TABLE,
    Key: { PK: 'GLOBAL', SK: 'AGGREGATE' }
  }));
  return result.Item || {};
}

// Parses a GLOBAL AGGREGATE item into structured stats
function parseGlobalItem(item) {
  return {
    totalRatings: item.totalRatings || 0,
    overallAverage: item.totalScore && item.totalRatings
      ? Number((item.totalScore / item.totalRatings).toFixed(2))
      : 0,
    ratingCounts: {
      1: item.count1 || 0,
      2: item.count2 || 0,
      3: item.count3 || 0,
      4: item.count4 || 0,
      5: item.count5 || 0
    }
  };
}

// Queries the TOP_PERFORMERS GSI and maps items to a common shape
async function readTopPerformers(client, limit = 8) {
  const result = await client.send(new QueryCommand({
    TableName: STATS_TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'TOP_PERFORMERS' },
    ScanIndexForward: false,
    Limit: limit
  }));
  const items = (result.Items || [])
    .filter(item => (item.totalRatings || 0) >= 3)
    .map(item => ({
      jokeId: item.PK.replace('STATS#', ''),
      joke: item.jokeText,
      author: item.author,
      totalRatings: item.totalRatings || 0,
      average: item.GSI1SK || 0,
      lastRatedAt: item.lastRatedAt
    }));
  return { items, count: result.Count || 0 };
}

// ─── Public exports ───────────────────────────────────────────────────────────

// O(1) read for global totals — used by homepage live counter
export async function readGlobalStats() {
  const client = getDynamoClient();
  const item = await readGlobalItem(client);
  const { totalRatings, overallAverage } = parseGlobalItem(item);
  return { totalRatings, overallAverage };
}

// Returns one random joke from the top-rated pool — used for the featured joke
export async function getRandomTopJoke() {
  const client = getDynamoClient();
  const { items } = await readTopPerformers(client, 10);
  const candidates = items.filter(p => p.joke);
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const parts = (pick.joke || '').split(' || ');
  return {
    jokeId: pick.jokeId,
    opener: parts[0]?.trim() || '',
    punchline: parts[1]?.trim() || '',
    author: pick.author || null,
    totalRatings: pick.totalRatings,
    average: pick.average
  };
}

// Top jokes from the past 7 days — aggregates raw rating records from GSI1
export async function getWeeklyTopJokes() {
  const client = getDynamoClient()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const result = await client.send(new QueryCommand({
    TableName: RATINGS_TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK >= :weekAgo',
    ExpressionAttributeValues: { ':pk': 'ALL_RATINGS', ':weekAgo': weekAgo },
    ScanIndexForward: false,
    Limit: 500,
  }))

  const jokeMap = {}
  for (const item of result.Items || []) {
    const jokeId = item.PK.replace('JOKE#', '')
    if (!jokeMap[jokeId]) {
      jokeMap[jokeId] = {
        jokeId,
        joke: item.jokeText || null,
        author: item.author || null,
        totalScore: 0,
        totalRatings: 0,
      }
    }
    jokeMap[jokeId].totalScore += Number(item.rating || 0)
    jokeMap[jokeId].totalRatings += 1
  }

  return Object.values(jokeMap)
    .filter(j => j.totalRatings >= 2)
    .map(j => ({
      ...j,
      average: Number((j.totalScore / j.totalRatings).toFixed(2)),
    }))
    .sort((a, b) => b.average - a.average || b.totalRatings - a.totalRatings)
    .slice(0, 20)
}

// O(1) read for dashboard - pre-computed global stats
export async function getDashboardStats() {
  const client = getDynamoClient();

  // All 4 queries run in parallel
  const [globalItem, authorsResult, topResult, recentResult] = await Promise.all([
    readGlobalItem(client),

    // Author stats (query all AUTHOR# sort keys)
    client.send(new QueryCommand({
      TableName: STATS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'GLOBAL',
        ':sk': 'AUTHOR#'
      }
    })),

    readTopPerformers(client, 8),

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

  const { totalRatings: overallRatings, overallAverage, ratingCounts } = parseGlobalItem(globalItem);
  const topPerformers = topResult.items;
  const uniqueJokes = topResult.count;

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
      overallRatings,
      overallAverage,
      uniqueJokes,
      ratingCounts,
      byAuthor: authors.map(({ ratingCounts, ...rest }) => rest)
    },
    ratingDistribution: {
      overall: ratingCounts,
      byAuthor: authors.reduce((acc, a) => ({ ...acc, [a.author]: a.ratingCounts }), {})
    },
    topPerformers,
    recentRatings
  };
}

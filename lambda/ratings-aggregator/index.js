/**
 * Ratings Aggregator Lambda Function
 *
 * Triggered by DynamoDB Streams when new ratings are inserted into JokeRatings table.
 * Updates pre-computed statistics in JokeStats table for O(1) dashboard reads.
 *
 * Flow:
 * 1. New rating inserted into JokeRatings table
 * 2. DynamoDB Stream triggers this Lambda
 * 3. Lambda updates:
 *    - Per-joke stats (STATS#<jokeId>)
 *    - Global stats (GLOBAL#AGGREGATE)
 *    - Per-author stats (GLOBAL#AUTHOR#<author>)
 *    - Top performers index (GSI1)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand
} = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const STATS_TABLE = process.env.STATS_TABLE_NAME;

/**
 * Main Lambda handler
 * @param {Object} event - DynamoDB Stream event
 */
exports.handler = async (event) => {
  const startTime = Date.now();
  console.log(`Processing ${event.Records.length} records`);

  const results = {
    processed: 0,
    skipped: 0,
    errors: []
  };

  for (const record of event.Records) {
    try {
      // Only process INSERT events (new ratings)
      if (record.eventName !== 'INSERT') {
        results.skipped++;
        continue;
      }

      const newImage = record.dynamodb.NewImage;
      if (!newImage) {
        results.skipped++;
        continue;
      }

      // Extract rating data from DynamoDB format
      const rating = parseInt(newImage.rating?.N, 10);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        console.warn('Invalid rating value, skipping:', newImage.rating);
        results.skipped++;
        continue;
      }

      const jokeId = newImage.PK?.S?.replace('JOKE#', '') || 'unknown';
      const author = newImage.author?.S || 'Unknown';
      const jokeText = newImage.jokeText?.S || null;
      const mode = newImage.mode?.S || 'live';
      const submittedAt = newImage.submittedAt?.S || new Date().toISOString();

      // Update all stats in parallel
      await Promise.all([
        updateJokeStats(jokeId, rating, author, jokeText, mode, submittedAt),
        updateGlobalStats(rating),
        updateAuthorStats(author, rating)
      ]);

      results.processed++;
    } catch (error) {
      console.error('Error processing record:', error, record);
      results.errors.push({
        record: record.eventID,
        error: error.message
      });
    }
  }

  const duration = Date.now() - startTime;
  console.log(`Completed in ${duration}ms:`, results);

  // Return success even if some records failed (they will be retried)
  return {
    statusCode: 200,
    body: JSON.stringify(results)
  };
};

/**
 * Update per-joke statistics
 * Also maintains the TOP_PERFORMERS GSI for dashboard queries
 */
async function updateJokeStats(jokeId, rating, author, jokeText, mode, submittedAt) {
  const countField = `count${rating}`;
  const pk = `STATS#${jokeId}`;

  // First, get current stats to calculate new average for GSI1SK
  let currentTotal = 0;
  let currentScore = 0;

  try {
    const current = await docClient.send(new GetCommand({
      TableName: STATS_TABLE,
      Key: { PK: pk, SK: 'AGGREGATE' },
      ProjectionExpression: 'totalRatings, totalScore'
    }));

    if (current.Item) {
      currentTotal = current.Item.totalRatings || 0;
      currentScore = current.Item.totalScore || 0;
    }
  } catch (error) {
    // If read fails, continue with defaults (item might not exist yet)
    console.warn(`Could not read current stats for ${jokeId}:`, error.message);
  }

  const newTotal = currentTotal + 1;
  const newScore = currentScore + rating;
  const newAverage = Math.round((newScore / newTotal) * 100) / 100;

  // Only add to TOP_PERFORMERS index if joke has 3+ ratings
  const addToTopPerformers = newTotal >= 3;

  const updateExpression = [
    'SET totalRatings = if_not_exists(totalRatings, :zero) + :one',
    'totalScore = if_not_exists(totalScore, :zero) + :rating',
    `${countField} = if_not_exists(${countField}, :zero) + :one`,
    'lastRatedAt = :submittedAt',
    'author = if_not_exists(author, :author)',
    '#mode = if_not_exists(#mode, :mode)'
  ];

  const expressionAttributeValues = {
    ':zero': 0,
    ':one': 1,
    ':rating': rating,
    ':submittedAt': submittedAt,
    ':author': author,
    ':mode': mode
  };

  const expressionAttributeNames = {
    '#mode': 'mode'  // 'mode' is a reserved word
  };

  // Only update jokeText if provided and not already set
  if (jokeText) {
    updateExpression.push('jokeText = if_not_exists(jokeText, :jokeText)');
    expressionAttributeValues[':jokeText'] = jokeText;
  }

  // Add to TOP_PERFORMERS index if enough ratings
  if (addToTopPerformers) {
    updateExpression.push('GSI1PK = :topPerformers');
    updateExpression.push('GSI1SK = :average');
    expressionAttributeValues[':topPerformers'] = 'TOP_PERFORMERS';
    expressionAttributeValues[':average'] = newAverage;
  }

  await docClient.send(new UpdateCommand({
    TableName: STATS_TABLE,
    Key: { PK: pk, SK: 'AGGREGATE' },
    UpdateExpression: updateExpression.join(', '),
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames
  }));
}

/**
 * Update global statistics (total across all jokes)
 */
async function updateGlobalStats(rating) {
  const countField = `count${rating}`;

  await docClient.send(new UpdateCommand({
    TableName: STATS_TABLE,
    Key: { PK: 'GLOBAL', SK: 'AGGREGATE' },
    UpdateExpression: `
      SET totalRatings = if_not_exists(totalRatings, :zero) + :one,
          totalScore = if_not_exists(totalScore, :zero) + :rating,
          ${countField} = if_not_exists(${countField}, :zero) + :one,
          lastUpdatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
      ':rating': rating,
      ':now': new Date().toISOString()
    }
  }));
}

/**
 * Update per-author statistics
 */
async function updateAuthorStats(author, rating) {
  const countField = `count${rating}`;
  const normalizedAuthor = normalizeAuthor(author);

  await docClient.send(new UpdateCommand({
    TableName: STATS_TABLE,
    Key: { PK: 'GLOBAL', SK: `AUTHOR#${normalizedAuthor}` },
    UpdateExpression: `
      SET totalRatings = if_not_exists(totalRatings, :zero) + :one,
          totalScore = if_not_exists(totalScore, :zero) + :rating,
          ${countField} = if_not_exists(${countField}, :zero) + :one,
          author = :author,
          lastUpdatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
      ':rating': rating,
      ':author': normalizedAuthor,
      ':now': new Date().toISOString()
    }
  }));
}

/**
 * Normalize author names for consistent grouping
 */
function normalizeAuthor(author) {
  if (!author || typeof author !== 'string') {
    return 'Unknown';
  }

  const trimmed = author.trim();
  if (!trimmed) {
    return 'Unknown';
  }

  const lower = trimmed.toLowerCase();

  if (lower === 'fatherhood.gov' || lower === 'fatherhood.com') {
    return 'Fatherhood.gov';
  }

  if (lower === 'ai' || lower === 'ai generated') {
    return 'AI Generated';
  }

  if (lower === 'unknown') {
    return 'Unknown';
  }

  return trimmed;
}

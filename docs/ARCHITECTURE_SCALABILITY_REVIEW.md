# Architecture Scalability Review

## Executive Summary

This document analyzes the current architecture of the Dad Jokes application and provides recommendations for scaling to handle thousands of concurrent users and unlimited joke/rating submissions.

**Key Findings:**
- Dashboard loads every rating record from S3 on each page view (O(n) where n = total ratings)
- Per-joke ratings require N+1 S3 queries (list + fetch each file)
- All aggregations (counts, averages) computed in-memory on each request
- No caching of computed aggregations
- Unbounded in-memory storage can cause container crashes

**Recommended Solution:** DynamoDB with pre-computed aggregations and event-driven updates

---

## Current Architecture Analysis

### Data Flow Problems

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Request ─────► API Route ─────► S3 List Objects                       │
│       │                   │               │                                  │
│       │                   │               ▼                                  │
│       │                   │         For each object:                         │
│       │                   │         ─► S3 GetObject (N times)                │
│       │                   │               │                                  │
│       │                   │               ▼                                  │
│       │                   │         In-Memory Aggregation                    │
│       │                   │         (counts, averages, sorting)              │
│       │                   │               │                                  │
│       ◄───────────────────┴───────────────┘                                  │
│                                                                              │
│  Time Complexity: O(n) per request                                           │
│  S3 API Calls: 1 + n per request                                            │
│  Memory: O(n) - unbounded growth                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Specific Bottlenecks

#### 1. Dashboard Page (`/dashboard`)

**Location:** `pages/dashboard.js:327-335` → `lib/dashboardSummary.js:105-118` → `lib/ratingsStorage.js:475-667`

**Problem:** `summarizeRatings()` iterates through EVERY rating in S3:
```javascript
// lib/ratingsStorage.js:309-391
async function* iterateAllRatingEntries() {
  const dailyBlobs = await listAllBlobs(`${BLOB_PREFIX}/daily/`)  // Lists ALL daily ratings
  for (const blob of dailyBlobs) {
    const payload = await readBlobPayload(blob.pathname)  // GET each file individually
    // ... yields each entry
  }
  const liveBlobs = await listAllBlobs(`${BLOB_PREFIX}/live/`)  // Lists ALL live ratings
  for (const blob of liveBlobs) {
    // ... same pattern
  }
}
```

**Impact with 10,000 ratings:**
- 2 S3 ListObjectsV2 calls
- 10,000 S3 GetObject calls
- 10,000 JSON parses
- O(n log n) sorting for top performers
- Estimated latency: 30-60 seconds

#### 2. Per-Joke Ratings (`/api/ratings?jokeId=X`)

**Location:** `pages/api/ratings.js:18-19` → `lib/ratingsStorage.js:281-284`

**Problem:** Every GET reads all rating files for that joke:
```javascript
// lib/ratingsStorage.js:235-255
async function readDirectoryEntries({ mode, jokeId, dateKey }) {
  const blobs = await listAllBlobs(prefix)  // List all files in joke directory
  for (const blob of blobs) {
    const payload = await readBlobPayload(blob.pathname)  // Fetch each rating
    entries.push(...extractEntriesFromPayload(payload))
  }
  return entries
}
```

**Impact:** A popular joke with 500 ratings = 501 S3 API calls per page view.

#### 3. Rating Submission (`POST /api/ratings`)

**Location:** `pages/api/ratings.js:54-57`

**Problem:** After writing, re-fetches ALL ratings to return updated stats:
```javascript
await handleWriteReview({ mode, jokeId, dateKey, rating: parsedRating, joke, author })
const refreshedStats = await handleReadStats({ mode, jokeId, dateKey })  // Re-aggregates!
```

#### 4. In-Memory Storage Leak

**Location:** `lib/ratingsStorage.js:11-21`

**Problem:** Global memory store grows unbounded:
```javascript
const memoryStore = globalThis.__ratingsMemoryStore || createMemoryStore()
// Never pruned - grows until container crashes (~1-2GB on Vercel)
```

---

## Recommended Architecture: DynamoDB

### Why DynamoDB?

| Requirement | DynamoDB Capability |
|-------------|---------------------|
| Thousands of concurrent users | Auto-scaling, unlimited throughput |
| Pre-computed aggregations | Atomic counters, transactions |
| Fast point queries | O(1) by partition key |
| Cost-effective | Pay per request or provisioned |
| Serverless-friendly | No connection pooling issues |
| AWS ecosystem | Works with existing S3 infrastructure |

### Data Model Design

#### Table 1: `JokeRatings` (Individual Ratings)

```
Partition Key: PK (String)  - "JOKE#<jokeId>"
Sort Key: SK (String)       - "RATING#<timestamp>#<uuid>"

Attributes:
- rating (Number): 1-5
- jokeText (String): The joke content
- author (String): Joke author
- mode (String): "daily" | "live"
- date (String): YYYY-MM-DD for daily jokes
- submittedAt (String): ISO timestamp
- userId (String): Optional, for future auth

GSI1 (for recent ratings):
- GSI1PK: "ALL_RATINGS"
- GSI1SK: submittedAt (ISO timestamp)

GSI2 (for author queries):
- GSI2PK: "AUTHOR#<author>"
- GSI2SK: submittedAt
```

**Example Items:**
```json
{
  "PK": "JOKE#fatherhood-123",
  "SK": "RATING#2026-01-30T15:30:00Z#abc123",
  "rating": 4,
  "jokeText": "Why did the dad joke...",
  "author": "Fatherhood.gov",
  "mode": "daily",
  "date": "2026-01-30",
  "submittedAt": "2026-01-30T15:30:00Z",
  "GSI1PK": "ALL_RATINGS",
  "GSI1SK": "2026-01-30T15:30:00Z"
}
```

#### Table 2: `JokeStats` (Pre-computed Aggregations)

```
Partition Key: PK (String)  - "STATS#<jokeId>" or "GLOBAL"
Sort Key: SK (String)       - "AGGREGATE" or "AUTHOR#<author>"

Attributes:
- totalRatings (Number): Atomic counter
- totalScore (Number): Sum for average calculation
- count1-count5 (Number): Rating distribution
- lastRatedAt (String): ISO timestamp
- jokeText (String): For display

GSI1 (for top performers):
- GSI1PK: "TOP_PERFORMERS"
- GSI1SK: averageRating (Number) - maintained on update
```

**Example Items:**
```json
// Per-joke stats
{
  "PK": "STATS#fatherhood-123",
  "SK": "AGGREGATE",
  "totalRatings": 47,
  "totalScore": 188,
  "count1": 2, "count2": 5, "count3": 10, "count4": 20, "count5": 10,
  "lastRatedAt": "2026-01-30T15:30:00Z",
  "jokeText": "Why did the dad joke...",
  "author": "Fatherhood.gov",
  "GSI1PK": "TOP_PERFORMERS",
  "GSI1SK": 4.0
}

// Global stats
{
  "PK": "GLOBAL",
  "SK": "AGGREGATE",
  "totalRatings": 5420,
  "totalScore": 21680,
  "uniqueJokes": 342,
  "count1": 100, "count2": 500, "count3": 1200, "count4": 2000, "count5": 1620
}

// Per-author stats
{
  "PK": "GLOBAL",
  "SK": "AUTHOR#Fatherhood.gov",
  "totalRatings": 3200,
  "totalScore": 12800,
  "count1": 50, "count2": 300, "count3": 700, "count4": 1200, "count5": 950
}
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RECOMMENDED ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐      ┌─────────────┐      ┌─────────────────────────────────┐ │
│  │          │      │             │      │         DynamoDB                │ │
│  │   User   │─────►│  Vercel     │─────►│  ┌───────────┬─────────────┐   │ │
│  │ Request  │      │  API Route  │      │  │JokeRatings│  JokeStats  │   │ │
│  │          │◄─────│             │◄─────│  │(writes)   │  (reads)    │   │ │
│  └──────────┘      └─────────────┘      │  └───────────┴─────────────┘   │ │
│                           │              │         │                      │ │
│                           │              └─────────┼──────────────────────┘ │
│                           │                        │                        │
│                           │              ┌─────────▼──────────────────────┐ │
│                           │              │      DynamoDB Streams          │ │
│                           │              │  (triggers on write)           │ │
│                           │              └─────────┬──────────────────────┘ │
│                           │                        │                        │
│                           │              ┌─────────▼──────────────────────┐ │
│                           │              │      Lambda Function           │ │
│                           │              │  - Update JokeStats counters   │ │
│                           │              │  - Update global stats         │ │
│                           │              │  - Update author stats         │ │
│                           │              └────────────────────────────────┘ │
│                                                                              │
│  Read Complexity: O(1) - single DynamoDB query                              │
│  Write Complexity: O(1) - single DynamoDB write + async Lambda              │
│  Memory: Bounded - no in-memory aggregation                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Terraform Infrastructure

Create `terraform/dynamodb.tf`:

```hcl
# terraform/dynamodb.tf

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "read_capacity" {
  description = "Read capacity units for provisioned mode (ignored for PAY_PER_REQUEST)"
  type        = number
  default     = 5
}

variable "write_capacity" {
  description = "Write capacity units for provisioned mode (ignored for PAY_PER_REQUEST)"
  type        = number
  default     = 5
}

# DynamoDB Table: JokeRatings (individual rating records)
resource "aws_dynamodb_table" "joke_ratings" {
  name         = "dad-jokes-ratings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"  # Auto-scaling, pay per use
  hash_key     = "PK"
  sort_key     = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # GSI for recent ratings (all ratings by time)
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # GSI for author-based queries
  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
  }

  # Enable DynamoDB Streams for event-driven updates
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # Point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }

  # TTL for automatic cleanup of old daily ratings (optional)
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = {
    Application = "dad-jokes"
    Environment = var.environment
  }
}

# DynamoDB Table: JokeStats (pre-computed aggregations)
resource "aws_dynamodb_table" "joke_stats" {
  name         = "dad-jokes-stats-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  sort_key     = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "N"
  }

  # GSI for top performers (sorted by average rating)
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Application = "dad-jokes"
    Environment = var.environment
  }
}

# Lambda function for processing DynamoDB Stream events
resource "aws_lambda_function" "ratings_aggregator" {
  function_name = "dad-jokes-ratings-aggregator-${var.environment}"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      STATS_TABLE_NAME   = aws_dynamodb_table.joke_stats.name
      RATINGS_TABLE_NAME = aws_dynamodb_table.joke_ratings.name
    }
  }

  tags = {
    Application = "dad-jokes"
    Environment = var.environment
  }
}

# Package Lambda code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/ratings-aggregator"
  output_path = "${path.module}/.terraform/lambda-ratings-aggregator.zip"
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "dad-jokes-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Lambda permissions for DynamoDB
resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = [
          aws_dynamodb_table.joke_ratings.arn,
          aws_dynamodb_table.joke_stats.arn,
          "${aws_dynamodb_table.joke_ratings.arn}/stream/*",
          "${aws_dynamodb_table.joke_ratings.arn}/index/*",
          "${aws_dynamodb_table.joke_stats.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Connect DynamoDB Stream to Lambda
resource "aws_lambda_event_source_mapping" "ratings_stream" {
  event_source_arn  = aws_dynamodb_table.joke_ratings.stream_arn
  function_name     = aws_lambda_function.ratings_aggregator.arn
  starting_position = "LATEST"
  batch_size        = 100

  # Process in parallel for higher throughput
  parallelization_factor = 2
}

# Outputs for application configuration
output "ratings_table_name" {
  value = aws_dynamodb_table.joke_ratings.name
}

output "stats_table_name" {
  value = aws_dynamodb_table.joke_stats.name
}

output "ratings_table_arn" {
  value = aws_dynamodb_table.joke_ratings.arn
}

output "stats_table_arn" {
  value = aws_dynamodb_table.joke_stats.arn
}
```

---

## Lambda Aggregator Function

Create `lambda/ratings-aggregator/index.js`:

```javascript
// lambda/ratings-aggregator/index.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const STATS_TABLE = process.env.STATS_TABLE_NAME;

exports.handler = async (event) => {
  console.log(`Processing ${event.Records.length} records`);

  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue;

    const newImage = record.dynamodb.NewImage;
    const rating = parseInt(newImage.rating.N, 10);
    const jokeId = newImage.PK.S.replace('JOKE#', '');
    const author = newImage.author?.S || 'Unknown';
    const jokeText = newImage.jokeText?.S || null;
    const submittedAt = newImage.submittedAt?.S || new Date().toISOString();

    // Update per-joke stats
    await updateJokeStats(jokeId, rating, author, jokeText, submittedAt);

    // Update global stats
    await updateGlobalStats(rating);

    // Update per-author stats
    await updateAuthorStats(author, rating);
  }

  return { statusCode: 200 };
};

async function updateJokeStats(jokeId, rating, author, jokeText, submittedAt) {
  const countField = `count${rating}`;

  // First, get current stats to calculate new average
  const current = await docClient.send(new GetCommand({
    TableName: STATS_TABLE,
    Key: { PK: `STATS#${jokeId}`, SK: 'AGGREGATE' }
  }));

  const currentTotal = current.Item?.totalRatings || 0;
  const currentScore = current.Item?.totalScore || 0;
  const newTotal = currentTotal + 1;
  const newScore = currentScore + rating;
  const newAverage = Math.round((newScore / newTotal) * 100) / 100;

  await docClient.send(new UpdateCommand({
    TableName: STATS_TABLE,
    Key: { PK: `STATS#${jokeId}`, SK: 'AGGREGATE' },
    UpdateExpression: `
      SET totalRatings = if_not_exists(totalRatings, :zero) + :one,
          totalScore = if_not_exists(totalScore, :zero) + :rating,
          ${countField} = if_not_exists(${countField}, :zero) + :one,
          lastRatedAt = :submittedAt,
          author = if_not_exists(author, :author),
          jokeText = if_not_exists(jokeText, :jokeText),
          GSI1PK = :topPerformers,
          GSI1SK = :average
    `,
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
      ':rating': rating,
      ':submittedAt': submittedAt,
      ':author': author,
      ':jokeText': jokeText,
      ':topPerformers': 'TOP_PERFORMERS',
      ':average': newAverage
    }
  }));
}

async function updateGlobalStats(rating) {
  const countField = `count${rating}`;

  await docClient.send(new UpdateCommand({
    TableName: STATS_TABLE,
    Key: { PK: 'GLOBAL', SK: 'AGGREGATE' },
    UpdateExpression: `
      SET totalRatings = if_not_exists(totalRatings, :zero) + :one,
          totalScore = if_not_exists(totalScore, :zero) + :rating,
          ${countField} = if_not_exists(${countField}, :zero) + :one
    `,
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
      ':rating': rating
    }
  }));
}

async function updateAuthorStats(author, rating) {
  const countField = `count${rating}`;

  await docClient.send(new UpdateCommand({
    TableName: STATS_TABLE,
    Key: { PK: 'GLOBAL', SK: `AUTHOR#${author}` },
    UpdateExpression: `
      SET totalRatings = if_not_exists(totalRatings, :zero) + :one,
          totalScore = if_not_exists(totalScore, :zero) + :rating,
          ${countField} = if_not_exists(${countField}, :zero) + :one,
          author = :author
    `,
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
      ':rating': rating,
      ':author': author
    }
  }));
}
```

---

## Application Code Changes

### New DynamoDB Client (`lib/dynamoClient.js`)

```javascript
// lib/dynamoClient.js
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

let cachedClient = null;

export function getDynamoClient() {
  if (cachedClient) return cachedClient;

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
  });

  cachedClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true }
  });

  return cachedClient;
}

export const RATINGS_TABLE = process.env.DYNAMODB_RATINGS_TABLE || 'dad-jokes-ratings-prod';
export const STATS_TABLE = process.env.DYNAMODB_STATS_TABLE || 'dad-jokes-stats-prod';

export { GetCommand, PutCommand, QueryCommand, UpdateCommand };
```

### Updated Ratings Storage (`lib/ratingsStorageDynamo.js`)

```javascript
// lib/ratingsStorageDynamo.js
import { randomUUID } from 'node:crypto';
import { getDynamoClient, RATINGS_TABLE, STATS_TABLE, PutCommand, GetCommand, QueryCommand } from './dynamoClient';

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
```

---

## Migration Strategy

### Phase 1: Deploy Infrastructure (Day 1)
1. Apply terraform to create DynamoDB tables
2. Deploy Lambda aggregator function
3. Add new environment variables to Vercel

### Phase 2: Dual-Write Mode (Days 2-7)
1. Update API to write to both S3 and DynamoDB
2. Monitor DynamoDB for consistency
3. Keep S3 as source of truth

```javascript
// Temporary dual-write in ratings API
await Promise.all([
  handleWriteReview({ mode, jokeId, dateKey, rating, joke, author }),  // S3
  writeRatingToDynamo({ jokeId, rating, joke, author, mode, dateKey }) // DynamoDB
]);
```

### Phase 3: Migration Script (Day 8)
```javascript
// scripts/migrate-ratings-to-dynamo.mjs
import { iterateAllRatingEntries } from '../lib/ratingsStorage.js';
import { writeRating } from '../lib/ratingsStorageDynamo.js';

async function migrate() {
  let count = 0;
  for await (const entry of iterateAllRatingEntries()) {
    await writeRating({
      jokeId: entry.jokeId,
      rating: entry.rating,
      joke: entry.joke,
      author: entry.author,
      mode: entry.mode,
      dateKey: entry.date
    });
    count++;
    if (count % 100 === 0) console.log(`Migrated ${count} ratings`);
  }
  console.log(`Migration complete: ${count} ratings`);
}

migrate().catch(console.error);
```

### Phase 4: Switch to DynamoDB (Day 9-10)
1. Update `/api/ratings` to read from DynamoDB
2. Update dashboard to use `getDashboardStats()`
3. Monitor performance

### Phase 5: Cleanup (Day 14+)
1. Remove S3 dual-write code
2. Archive S3 rating data
3. Remove in-memory storage code

---

## Performance Comparison

| Operation | Current (S3) | Proposed (DynamoDB) | Improvement |
|-----------|--------------|---------------------|-------------|
| Dashboard load | 30-60s (10K ratings) | <100ms | **300-600x** |
| Per-joke ratings | 500ms-5s | <50ms | **10-100x** |
| Submit rating | 200ms + re-aggregate | <50ms | **4x** |
| Memory usage | Unbounded (crashes) | Constant | **Stable** |
| Concurrent users | ~100 | Unlimited | **10x+** |

---

## Cost Analysis

### DynamoDB Pricing (us-east-1, PAY_PER_REQUEST)

| Operation | Cost | Monthly Usage (1M ratings) | Monthly Cost |
|-----------|------|---------------------------|--------------|
| Write | $1.25/million | 1M writes | $1.25 |
| Read | $0.25/million | 10M reads | $2.50 |
| Storage | $0.25/GB | ~1GB | $0.25 |
| Streams | $0.02/100K reads | 1M | $0.20 |
| Lambda | Free tier + $0.20/M | 1M | ~$0.20 |
| **Total** | | | **~$4.40/month** |

### Current S3 Costs (estimated)

| Operation | Cost | Monthly Usage (1M ratings) | Monthly Cost |
|-----------|------|---------------------------|--------------|
| PUT | $0.005/1K | 1M writes | $5.00 |
| GET | $0.0004/1K | 10M+ reads (N+1 queries) | $4.00+ |
| LIST | $0.005/1K | 500K lists | $2.50 |
| Storage | $0.023/GB | ~1GB | $0.023 |
| **Total** | | | **~$11.50/month** |

**DynamoDB is ~60% cheaper AND infinitely faster.**

---

## Environment Variables

Add to Vercel:

```bash
# DynamoDB Tables
DYNAMODB_RATINGS_TABLE=dad-jokes-ratings-prod
DYNAMODB_STATS_TABLE=dad-jokes-stats-prod

# AWS Credentials (if not using Vercel's AWS integration)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

---

## Alternative Approaches Considered

### 1. Redis/ElastiCache
**Pros:** Very fast, good for caching
**Cons:** Requires VPC setup, connection pooling in serverless, additional infrastructure complexity
**Verdict:** Good for caching layer on top of DynamoDB, but not as primary store

### 2. Aurora Serverless v2
**Pros:** SQL queries, familiar relational model
**Cons:** Higher cost (~$0.12/ACU-hour), cold start latency, connection pooling issues
**Verdict:** Overkill for this use case

### 3. Cloudflare D1 (SQLite at edge)
**Pros:** Zero cold start, global distribution
**Cons:** Requires Cloudflare Workers, different deployment model
**Verdict:** Good option if migrating away from Vercel

### 4. Upstash Redis
**Pros:** Serverless Redis, HTTP-based (no connection issues)
**Cons:** Less durable than DynamoDB, limited query patterns
**Verdict:** Good for caching, not primary storage

---

## Summary

The current architecture has fundamental scalability issues due to:
1. N+1 S3 queries for every read operation
2. In-memory aggregation on every request
3. Unbounded memory growth

**Recommended solution:** DynamoDB with pre-computed aggregations updated via DynamoDB Streams + Lambda.

This provides:
- O(1) reads instead of O(n)
- Automatic scaling to unlimited concurrent users
- Lower cost than current S3 approach
- No in-memory state management
- Eventually consistent aggregations (acceptable for this use case)

The migration can be done incrementally with dual-write mode, minimizing risk.

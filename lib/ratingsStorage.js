import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

const DEFAULT_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_RECENT_RATINGS = 20

const TABLE_NAME = process.env.RATINGS_TABLE_NAME || process.env.RATINGS_TABLE || null
const QUEUE_URL = process.env.RATINGS_QUEUE_URL || process.env.SQS_QUEUE_URL || null
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null

let documentClient = null
let sqsClient = null
let initializationPromise = null

function hasAwsCredentialsConfigured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_ROLE_ARN ||
      process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
      process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
      process.env.AWS_ENDPOINT
  )
}

function isAwsConfigured() {
  return Boolean(TABLE_NAME && AWS_REGION && hasAwsCredentialsConfigured())
}

function getDocumentClient() {
  if (!documentClient) {
    const baseClient = new DynamoDBClient({
      region: AWS_REGION,
      ...(process.env.AWS_ENDPOINT ? { endpoint: process.env.AWS_ENDPOINT } : {})
    })
    documentClient = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: { removeUndefinedValues: true }
    })
  }
  return documentClient
}

function getSqsClient() {
  if (!QUEUE_URL) {
    return null
  }
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: AWS_REGION,
      ...(process.env.AWS_ENDPOINT ? { endpoint: process.env.AWS_ENDPOINT } : {})
    })
  }
  return sqsClient
}

function getMode(value) {
  return value === 'daily' ? 'daily' : 'live'
}

function resolveDateKey(input) {
  if (typeof input === 'string' && DATE_REGEX.test(input)) {
    return input
  }
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function validateRating(value) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null
  }
  return rating
}

function buildDefaultStats(overrides = {}) {
  return {
    counts: { ...DEFAULT_COUNTS },
    totalRatings: 0,
    average: 0,
    ratings: [],
    ...overrides
  }
}

function cloneCounts(counts = {}) {
  return { 1: counts[1] || 0, 2: counts[2] || 0, 3: counts[3] || 0, 4: counts[4] || 0, 5: counts[5] || 0 }
}

function safeAverage(score, total) {
  if (!total) {
    return 0
  }
  return Number((score / total).toFixed(2))
}

function sanitizeEventId(timestamp) {
  return `${timestamp}#${randomUUID()}`
}

async function enqueueRatingEvent(event) {
  const client = getSqsClient()
  if (!client) {
    return
  }
  try {
    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(event)
    })
    await client.send(command)
  } catch (error) {
    console.error('[ratings] Failed to enqueue rating event', { error })
  }
}

function buildRatingEvent({ jokeId, rating, joke, mode, dateKey, submittedAt, eventId }) {
  const normalizedSubmittedAt = submittedAt || new Date().toISOString()
  return {
    eventId: eventId || sanitizeEventId(normalizedSubmittedAt),
    jokeId,
    rating,
    joke: joke || null,
    mode,
    dateKey,
    submittedAt: normalizedSubmittedAt
  }
}

function buildTransactItemsForEvent(event) {
  const ratingKey = event.rating.toString()
  const isLive = event.mode === 'live'
  const isDaily = event.mode === 'daily'

  const baseValues = {
    ':zero': 0,
    ':one': 1,
    ':rating': event.rating,
    ':submittedAt': event.submittedAt,
    ':empty': {},
    ':liveIncrement': isLive ? 1 : 0,
    ':dailyIncrement': isDaily ? 1 : 0,
    ':liveScoreIncrement': isLive ? event.rating : 0,
    ':dailyScoreIncrement': isDaily ? event.rating : 0
  }

  const items = [
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          pk: 'EVENT',
          sk: event.eventId,
          jokeId: event.jokeId,
          mode: event.mode,
          rating: event.rating,
          submittedAt: event.submittedAt,
          dateKey: event.dateKey
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }
    },
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          pk: 'RECENT',
          sk: event.eventId,
          jokeId: event.jokeId,
          rating: event.rating,
          mode: event.mode,
          joke: event.joke || null,
          submittedAt: event.submittedAt,
          dateKey: event.dateKey
        }
      }
    },
    {
      Update: {
        TableName: TABLE_NAME,
        Key: { pk: 'DATE', sk: event.dateKey },
        UpdateExpression:
          'SET totalRatings = if_not_exists(totalRatings, :zero) + :one, totalScore = if_not_exists(totalScore, :zero) + :rating, ratingCounts = if_not_exists(ratingCounts, :empty), ratingCounts.#score = if_not_exists(ratingCounts.#score, :zero) + :one, liveRatings = if_not_exists(liveRatings, :zero) + :liveIncrement, liveScore = if_not_exists(liveScore, :zero) + :liveScoreIncrement, dailyRatings = if_not_exists(dailyRatings, :zero) + :dailyIncrement, dailyScore = if_not_exists(dailyScore, :zero) + :dailyScoreIncrement, firstReviewAt = if_not_exists(firstReviewAt, :submittedAt), latestReviewAt = :submittedAt',
        ExpressionAttributeNames: { '#score': ratingKey },
        ExpressionAttributeValues: baseValues
      }
    }
  ]

  if (isLive) {
    items.push({
      Update: {
        TableName: TABLE_NAME,
        Key: { pk: 'LIVE', sk: event.jokeId },
        UpdateExpression:
          'SET totalRatings = if_not_exists(totalRatings, :zero) + :one, totalScore = if_not_exists(totalScore, :zero) + :rating, ratingCounts = if_not_exists(ratingCounts, :empty), ratingCounts.#score = if_not_exists(ratingCounts.#score, :zero) + :one, lastRatedAt = :submittedAt, firstRatedAt = if_not_exists(firstRatedAt, :submittedAt)' +
          (event.joke ? ', joke = if_not_exists(joke, :joke)' : ''),
        ExpressionAttributeNames: { '#score': ratingKey },
        ExpressionAttributeValues: {
          ...baseValues,
          ...(event.joke ? { ':joke': event.joke } : {})
        }
      }
    })
  }

  if (isDaily) {
    items.push({
      Update: {
        TableName: TABLE_NAME,
        Key: { pk: 'DAILY', sk: `${event.dateKey}#${event.jokeId}` },
        UpdateExpression:
          'SET totalRatings = if_not_exists(totalRatings, :zero) + :one, totalScore = if_not_exists(totalScore, :zero) + :rating, ratingCounts = if_not_exists(ratingCounts, :empty), ratingCounts.#score = if_not_exists(ratingCounts.#score, :zero) + :one, lastRatedAt = :submittedAt, firstRatedAt = if_not_exists(firstRatedAt, :submittedAt), jokeId = if_not_exists(jokeId, :jokeId)' +
          (event.joke ? ', joke = if_not_exists(joke, :joke)' : ''),
        ExpressionAttributeNames: { '#score': ratingKey },
        ExpressionAttributeValues: {
          ...baseValues,
          ':jokeId': event.jokeId,
          ...(event.joke ? { ':joke': event.joke } : {})
        }
      }
    })
  }

  return items
}

async function applyRatingEvent(event) {
  if (!isAwsConfigured()) {
    throw new Error('DynamoDB configuration missing')
  }
  const client = getDocumentClient()
  const transactItems = buildTransactItemsForEvent(event)
  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: transactItems
      })
    )
  } catch (error) {
    if (error?.name === 'TransactionCanceledException') {
      const cancellationReasons = error.CancellationReasons || []
      const alreadyProcessed = cancellationReasons.some((reason) => reason?.Code === 'ConditionalCheckFailed')
      if (!alreadyProcessed) {
        console.error('[ratings] Failed to apply rating event', { event, error })
        throw error
      }
    } else {
      console.error('[ratings] Failed to apply rating event', { event, error })
      throw error
    }
  }
}

async function getLiveStats(jokeId) {
  if (!isAwsConfigured()) {
    return buildDefaultStats()
  }
  const client = getDocumentClient()
  const response = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'LIVE', sk: jokeId }
    })
  )
  const item = response.Item
  if (!item) {
    return buildDefaultStats()
  }
  const counts = cloneCounts(item.ratingCounts || {})
  const totalRatings = Number(item.totalRatings || 0)
  const totalScore = Number(item.totalScore || 0)
  return {
    counts,
    totalRatings,
    average: safeAverage(totalScore, totalRatings),
    ratings: [],
    jokeId,
    mode: 'live',
    lastRatedAt: item.lastRatedAt || null
  }
}

async function getDailyStats(jokeId, dateKey) {
  if (!isAwsConfigured()) {
    return buildDefaultStats({ date: dateKey })
  }
  const client = getDocumentClient()
  const response = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'DAILY', sk: `${dateKey}#${jokeId}` }
    })
  )
  const item = response.Item
  if (!item) {
    return buildDefaultStats({ date: dateKey })
  }
  const counts = cloneCounts(item.ratingCounts || {})
  const totalRatings = Number(item.totalRatings || 0)
  const totalScore = Number(item.totalScore || 0)
  return {
    counts,
    totalRatings,
    average: safeAverage(totalScore, totalRatings),
    ratings: [],
    jokeId,
    date: dateKey,
    mode: 'daily',
    lastRatedAt: item.lastRatedAt || null
  }
}

async function handleReadStats({ mode, jokeId, dateKey }) {
  await ensureInitialized()
  if (mode === 'daily') {
    return getDailyStats(jokeId, dateKey)
  }
  return getLiveStats(jokeId)
}

async function handleWriteReview({ mode, jokeId, dateKey, rating, joke }) {
  const event = buildRatingEvent({ jokeId, rating, joke, mode, dateKey })
  await recordRatingEvent(event)
  if (mode === 'daily') {
    return getDailyStats(jokeId, dateKey)
  }
  return getLiveStats(jokeId)
}

async function recordRatingEvent(event, { enqueue = true } = {}) {
  await ensureInitialized()
  if (enqueue) {
    await enqueueRatingEvent(event)
  }
  await applyRatingEvent(event)
}

async function queryAllByPk(pk, { descending = false, limit = null } = {}) {
  if (!isAwsConfigured()) {
    return []
  }
  const client = getDocumentClient()
  let items = []
  let ExclusiveStartKey
  do {
    const response = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'pk' },
        ExpressionAttributeValues: { ':pk': pk },
        ScanIndexForward: !descending,
        Limit: limit || undefined,
        ExclusiveStartKey
      })
    )
    if (Array.isArray(response.Items)) {
      items = items.concat(response.Items)
    }
    ExclusiveStartKey = response.LastEvaluatedKey
    if (limit && items.length >= limit) {
      items = items.slice(0, limit)
      break
    }
  } while (ExclusiveStartKey)
  return items
}

function sortByAverageDesc(items) {
  return items
    .slice()
    .sort((a, b) => {
      const avgA = safeAverage(Number(a.totalScore || 0), Number(a.totalRatings || 0))
      const avgB = safeAverage(Number(b.totalScore || 0), Number(b.totalRatings || 0))
      if (avgB === avgA) {
        return Number(b.totalRatings || 0) - Number(a.totalRatings || 0)
      }
      return avgB - avgA
    })
}

function extractRecentRatings(items = []) {
  return items
    .slice(0, MAX_RECENT_RATINGS)
    .map((item) => ({
      jokeId: item.jokeId,
      mode: item.mode,
      rating: item.rating,
      joke: item.joke || null,
      submittedAt: item.submittedAt,
      date: item.dateKey
    }))
}

function mergeCounts(target, source = {}) {
  const result = { ...target }
  for (const key of Object.keys(DEFAULT_COUNTS)) {
    const current = Number(result[key] || 0)
    const addition = Number(source[key] || 0)
    result[key] = current + addition
  }
  return result
}

async function summarizeRatings() {
  await ensureInitialized()
  if (!isAwsConfigured()) {
    return {
      totals: {
        overallRatings: 0,
        overallAverage: 0,
        uniqueJokes: 0,
        firstReviewAt: null,
        latestReviewAt: null,
        ratingCounts: { ...DEFAULT_COUNTS },
        live: { totalRatings: 0, average: 0, ratingCounts: { ...DEFAULT_COUNTS } },
        daily: { totalRatings: 0, average: 0, ratingCounts: { ...DEFAULT_COUNTS } }
      },
      ratingDistribution: {
        overall: { ...DEFAULT_COUNTS },
        live: { ...DEFAULT_COUNTS },
        daily: { ...DEFAULT_COUNTS }
      },
      topLiveJokes: [],
      topDailyHighlights: [],
      highestVolumeDates: [],
      recentRatings: []
    }
  }

  const [liveItems, dailyItems, dateItems, recentItems] = await Promise.all([
    queryAllByPk('LIVE'),
    queryAllByPk('DAILY'),
    queryAllByPk('DATE'),
    queryAllByPk('RECENT', { descending: true, limit: MAX_RECENT_RATINGS })
  ])

  const liveCounts = { ...DEFAULT_COUNTS }
  const dailyCounts = { ...DEFAULT_COUNTS }
  let liveRatings = 0
  let liveScore = 0
  let dailyRatings = 0
  let dailyScore = 0
  const uniqueJokes = new Set()
  let firstReviewAt = null
  let latestReviewAt = null

  for (const item of liveItems) {
    uniqueJokes.add(item.sk)
    liveRatings += Number(item.totalRatings || 0)
    liveScore += Number(item.totalScore || 0)
    const counts = cloneCounts(item.ratingCounts || {})
    for (const key of Object.keys(DEFAULT_COUNTS)) {
      liveCounts[key] += Number(counts[key] || 0)
    }
    if (item.firstRatedAt && (!firstReviewAt || item.firstRatedAt < firstReviewAt)) {
      firstReviewAt = item.firstRatedAt
    }
    if (item.lastRatedAt && (!latestReviewAt || item.lastRatedAt > latestReviewAt)) {
      latestReviewAt = item.lastRatedAt
    }
  }

  for (const item of dailyItems) {
    dailyRatings += Number(item.totalRatings || 0)
    dailyScore += Number(item.totalScore || 0)
    const counts = cloneCounts(item.ratingCounts || {})
    for (const key of Object.keys(DEFAULT_COUNTS)) {
      dailyCounts[key] += Number(counts[key] || 0)
    }
    if (item.firstRatedAt && (!firstReviewAt || item.firstRatedAt < firstReviewAt)) {
      firstReviewAt = item.firstRatedAt
    }
    if (item.lastRatedAt && (!latestReviewAt || item.lastRatedAt > latestReviewAt)) {
      latestReviewAt = item.lastRatedAt
    }
  }

  const overallCounts = mergeCounts(liveCounts, dailyCounts)
  const overallRatings = liveRatings + dailyRatings
  const overallScore = liveScore + dailyScore

  const topLiveJokes = sortByAverageDesc(liveItems)
    .filter((item) => Number(item.totalRatings || 0) >= 3)
    .slice(0, 10)
    .map((item) => ({
      jokeId: item.sk,
      joke: item.joke || null,
      totalRatings: Number(item.totalRatings || 0),
      average: safeAverage(Number(item.totalScore || 0), Number(item.totalRatings || 0)),
      counts: cloneCounts(item.ratingCounts || {}),
      lastRatedAt: item.lastRatedAt || null
    }))

  const topDailyHighlights = dailyItems
    .slice()
    .sort((a, b) => {
      const avgA = safeAverage(Number(a.totalScore || 0), Number(a.totalRatings || 0))
      const avgB = safeAverage(Number(b.totalScore || 0), Number(b.totalRatings || 0))
      if (avgB === avgA) {
        return Number(b.totalRatings || 0) - Number(a.totalRatings || 0)
      }
      return avgB - avgA
    })
    .slice(0, 10)
    .map((item) => {
      const [dateKey] = String(item.sk || '').split('#')
      return {
        date: dateKey,
        totalRatings: Number(item.totalRatings || 0),
        dailyRatings: Number(item.totalRatings || 0),
        average: safeAverage(Number(item.totalScore || 0), Number(item.totalRatings || 0))
      }
    })

  const highestVolumeDates = dateItems
    .slice()
    .sort((a, b) => {
      const totalA = Number(a.totalRatings || 0)
      const totalB = Number(b.totalRatings || 0)
      if (totalB === totalA) {
        const avgA = safeAverage(Number(a.totalScore || 0), totalA)
        const avgB = safeAverage(Number(b.totalScore || 0), totalB)
        return avgB - avgA
      }
      return totalB - totalA
    })
    .slice(0, 10)
    .map((item) => ({
      date: item.sk,
      totalRatings: Number(item.totalRatings || 0),
      liveRatings: Number(item.liveRatings || 0),
      dailyRatings: Number(item.dailyRatings || 0),
      average: safeAverage(Number(item.totalScore || 0), Number(item.totalRatings || 0))
    }))

  const recentRatings = extractRecentRatings(recentItems)

  return {
    totals: {
      overallRatings,
      overallAverage: safeAverage(overallScore, overallRatings),
      uniqueJokes: uniqueJokes.size,
      firstReviewAt: firstReviewAt || null,
      latestReviewAt: latestReviewAt || null,
      ratingCounts: overallCounts,
      live: {
        totalRatings: liveRatings,
        average: safeAverage(liveScore, liveRatings),
        ratingCounts: liveCounts
      },
      daily: {
        totalRatings: dailyRatings,
        average: safeAverage(dailyScore, dailyRatings),
        ratingCounts: dailyCounts
      }
    },
    ratingDistribution: {
      overall: overallCounts,
      live: liveCounts,
      daily: dailyCounts
    },
    topLiveJokes,
    topDailyHighlights,
    highestVolumeDates,
    recentRatings
  }
}

async function readAllRatingEntries() {
  await ensureInitialized()
  if (!isAwsConfigured()) {
    return []
  }
  const events = await queryAllByPk('EVENT')
  return events.map((item) => ({
    jokeId: item.jokeId || null,
    rating: item.rating,
    joke: item.joke || null,
    mode: item.mode || 'live',
    submittedAt: item.submittedAt,
    date: item.dateKey || null
  }))
}

async function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (!isAwsConfigured()) {
        console.warn(
          '[ratings] DynamoDB is not configured. Set RATINGS_TABLE_NAME and AWS_REGION to enable persistent storage.'
        )
        return
      }
    })()
  }
  await initializationPromise
}

export {
  DEFAULT_COUNTS,
  getMode,
  resolveDateKey,
  handleReadStats,
  handleWriteReview,
  summarizeRatings,
  validateRating,
  readAllRatingEntries,
  buildRatingEvent,
  recordRatingEvent,
  isAwsConfigured
}

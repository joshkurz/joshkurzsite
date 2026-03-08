import { getDynamoClient, STATS_TABLE, UpdateCommand } from '../../lib/dynamoClient'

const ALLOWED_PLATFORMS = new Set(['x', 'facebook', 'copy'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { jokeId, platform } = req.body

  if (!jokeId || typeof jokeId !== 'string') {
    return res.status(400).json({ error: 'jokeId required' })
  }

  if (!ALLOWED_PLATFORMS.has(platform)) {
    return res.status(400).json({ error: 'Invalid platform' })
  }

  try {
    const client = getDynamoClient()
    await client.send(new UpdateCommand({
      TableName: STATS_TABLE,
      Key: { PK: `STATS#${jokeId}`, SK: 'AGGREGATE' },
      UpdateExpression: 'ADD totalShares :one, #platformShares :one',
      ExpressionAttributeNames: { '#platformShares': `shares_${platform}` },
      ExpressionAttributeValues: { ':one': 1 },
    }))
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('share tracking error', err)
    return res.status(500).json({ error: 'Failed to track share' })
  }
}

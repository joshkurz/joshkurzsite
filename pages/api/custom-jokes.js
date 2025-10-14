import { recordAcceptedJoke, recordRejectedJoke } from '../../lib/customJokes'
import { createResponseWithFallback, getOpenAIClient } from '../../lib/openaiClient'

const MAX_FIELD_LENGTH = 500
const MIN_FIELD_LENGTH = 3

function parseRequestBody(req) {
  if (!req.body) {
    return {}
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch (error) {
      return {}
    }
  }
  return req.body
}

function sanitizeField(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function validateField(name, value) {
  if (value.length < MIN_FIELD_LENGTH) {
    return `${name} must be at least ${MIN_FIELD_LENGTH} characters`
  }
  if (value.length > MAX_FIELD_LENGTH) {
    return `${name} must be less than ${MAX_FIELD_LENGTH} characters`
  }
  return null
}

async function evaluateFamilyFriendly(openai, { opener, response }) {
  const combined = `${opener} ${response || ''}`.toLowerCase()
  if (openai.__mock) {
    const flaggedWords = ['kill', 'violence', 'explicit', 'drug', 'sex']
    const flagged = flaggedWords.find((word) => combined.includes(word))
    if (flagged) {
      return {
        accepted: false,
        reason: `Content flagged for inappropriate language: ${flagged}`
      }
    }
    return { accepted: true, reason: 'Mock approval' }
  }

  const prompt = `You are a moderator ensuring family friendly dad jokes. ` +
    `Review the following joke setup and punchline. ` +
    `If both are safe for all ages respond with a single line of JSON: ` +
    `{"decision":"accept","reason":"Approved"}. ` +
    `If anything is unsafe, respond with JSON: ` +
    `{"decision":"reject","reason":"<short explanation>"}. ` +
    `Only output valid JSON.\n\nSetup: ${opener}\nPunchline: ${response || ''}`

  const result = await createResponseWithFallback(
    openai,
    {
      input: prompt,
      temperature: 0,
      max_output_tokens: 200
    },
    { stream: false }
  )

  const output = (result.output_text || '').trim()
  if (!output) {
    return { accepted: false, reason: 'Empty moderation response' }
  }
  try {
    const payload = JSON.parse(output)
    const decision = String(payload.decision || '').toLowerCase()
    if (decision === 'accept') {
      return { accepted: true, reason: payload.reason || 'Approved' }
    }
    if (decision === 'reject') {
      return { accepted: false, reason: payload.reason || 'Rejected by policy' }
    }
  } catch (error) {
    // ignore parsing error and fall through to heuristic parsing
  }

  const normalized = output.toLowerCase()
  if (normalized.startsWith('accept')) {
    return { accepted: true, reason: output }
  }
  return { accepted: false, reason: output }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { setup, punchline, author } = parseRequestBody(req)
  const opener = sanitizeField(setup)
  const response = sanitizeField(punchline)
  const submitter = sanitizeField(author)

  const errors = [
    validateField('Setup', opener),
    validateField('Punchline', response),
    validateField('Author', submitter)
  ].filter(Boolean)

  if (errors.length > 0) {
    res.status(400).json({ error: errors[0] })
    return
  }

  const openai = await getOpenAIClient()

  try {
    const evaluation = await evaluateFamilyFriendly(openai, { opener, response })
    if (evaluation.accepted) {
      const joke = await recordAcceptedJoke({ opener, response, author: submitter })
      res.status(201).json({ status: 'accepted', joke })
      return
    }

    await recordRejectedJoke({ opener, response, author: submitter, reason: evaluation.reason })
    res.status(200).json({ status: 'rejected', reason: evaluation.reason })
  } catch (error) {
    console.error('[customJokes] Failed to process submission', error)
    res.status(500).json({ error: 'Unable to process joke submission' })
  }
}

import { buildAiJokePrompt, AI_JOKE_PROMPT_VERSION } from '../../lib/aiJokePrompt'
import { generateWithAnthropic, getAnthropicModel } from '../../lib/anthropicClient'
import { getRandomLocalJoke } from '../../lib/openaiClient'
import { recordAcceptedJoke } from '../../lib/customJokes'
import { getAiJokeNickname } from '../../lib/aiJokeNicknames'

function sanitizeLine(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseAiJokePayload(raw) {
  if (!raw) {
    throw new Error('Empty AI response')
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error('Unable to parse AI response JSON')
  }
  const setup = sanitizeLine(parsed.setup)
  const punchline = sanitizeLine(parsed.punchline)
  if (!setup || !punchline) {
    throw new Error('AI response missing setup or punchline')
  }
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map((tag) => sanitizeLine(tag)) : []
  return {
    setup,
    punchline,
    tags,
    source: 'ai',
    persist: true
  }
}

function buildMockAiJoke() {
  const examples = [
    {
      setup: 'I used to hate facial hair, but then it grew on me.',
      punchline: '',
      tags: ['mock', 'wordplay', 'one-liner'],
    },
    {
      setup: 'What do you call a sleeping dinosaur?',
      punchline: 'A dino-snore.',
      tags: ['mock', 'animals', 'pun'],
    },
    {
      setup: “I'm reading a thriller about a broken pencil.”,
      punchline: “It's pointless.”,
      tags: ['mock', 'wordplay', 'one-liner'],
    }
  ]
  const selected = examples[Math.floor(Math.random() * examples.length)]
  return { ...selected, source: 'mock', persist: true }
}

function buildFallbackJoke() {
  const raw = getRandomLocalJoke() || ''
  const [questionLine = '', answerLine = ''] = raw.split(/\r?\n/)
  const setup = sanitizeLine(questionLine.replace(/^question:\s*/i, ''))
  const punchline = sanitizeLine(answerLine.replace(/^answer:\s*/i, ''))
  return {
    setup: setup || 'Why did the joke generator take a break?',
    punchline: punchline || 'Because it ran out of punchlines to process.',
    tags: ['fallback'],
    source: 'fallback',
    persist: false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  let jokePayload
  let responseModel = null

  if (process.env.MOCK_OPENAI === 'true') {
    jokePayload = buildMockAiJoke()
    responseModel = 'mock'
  } else {
    try {
      const prompt = await buildAiJokePrompt()
      const result = await generateWithAnthropic(prompt)
      const output = sanitizeLine(result?.output_text)
      jokePayload = parseAiJokePayload(output)
      responseModel = result?.model || getAnthropicModel()
    } catch (error) {
      console.error('[ai-joke] Failed to generate joke from Anthropic, using fallback', error)
      jokePayload = buildFallbackJoke()
      responseModel = 'local-fallback'
    }
  }

  const modelName = responseModel || getAnthropicModel()
  const author = `${modelName} · AI Joke Prompt v${AI_JOKE_PROMPT_VERSION}`
  const nickname = getAiJokeNickname(modelName, AI_JOKE_PROMPT_VERSION)

  try {
    const shouldPersist = jokePayload.persist !== false
    const saved = shouldPersist
      ? await recordAcceptedJoke({
          opener: jokePayload.setup,
          response: jokePayload.punchline,
          author
        })
      : {
          id: null,
          opener: jokePayload.setup,
          response: jokePayload.punchline || null,
          text: jokePayload.punchline
            ? `Question: ${jokePayload.setup}\nAnswer: ${jokePayload.punchline}`
            : `Question: ${jokePayload.setup}`,
          author
        }

    const metadata = {
      tags: jokePayload.tags,
      promptVersion: AI_JOKE_PROMPT_VERSION,
      model: modelName,
      nickname,
      source: jokePayload.source,
      persisted: shouldPersist
    }

    res.status(shouldPersist ? 201 : 200).json({
      id: saved.id,
      opener: saved.opener,
      response: saved.response,
      text: saved.text,
      author: saved.author,
      metadata
    })
  } catch (error) {
    console.error('[ai-joke] Failed to persist generated joke', error)
    res.status(500).json({ error: 'Unable to store generated joke' })
  }
}

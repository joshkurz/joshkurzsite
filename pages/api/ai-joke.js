import { buildAiJokePrompt, AI_JOKE_PROMPT_VERSION } from '../../lib/aiJokePrompt'
import {
  createResponseWithFallback,
  getOpenAIClient,
  getRandomLocalJoke,
  getResponseModels
} from '../../lib/openaiClient'
import { recordAcceptedJoke } from '../../lib/customJokes'
import { getAiJokeNickname } from '../../lib/aiJokeNicknames'

const openai = getOpenAIClient()

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
  const template = sanitizeLine(parsed.template)
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map((tag) => sanitizeLine(tag)) : []
  const chosenWords =
    parsed.chosen_words && typeof parsed.chosen_words === 'object' ? parsed.chosen_words : {}
  const ratingNumber = Number(parsed.rating)
  const rating = Number.isFinite(ratingNumber) ? ratingNumber : null
  const why = sanitizeLine(parsed.why_this_is_funny)
  return {
    setup,
    punchline,
    template,
    tags,
    chosenWords,
    rating,
    why,
    source: 'ai',
    persist: true
  }
}

function buildMockAiJoke() {
  const examples = [
    {
      setup: 'Why did the scarecrow start a podcast?',
      punchline: 'Because he heard it was great for growing an audience.',
      template: 'why_question',
      tags: ['mock', 'farm'],
      chosenWords: { noun: 'scarecrow', verb: 'start', literal_reason: 'it was outstanding in its field' },
      rating: 3,
      why: 'Literal twist on “outstanding in its field.”'
    },
    {
      setup: 'What do you call a sleepy computer?',
      punchline: 'A power nap-top.',
      template: 'what_do_you_call',
      tags: ['mock', 'tech', 'pun'],
      chosenWords: { adjective: 'sleepy', noun: 'computer', pun_noun: 'nap-top' },
      rating: 4,
      why: 'Wordplay on laptop taking a power nap.'
    },
    {
      setup: 'Did you hear about the moon restaurant?',
      punchline: 'Great food — no atmosphere.',
      template: 'did_hear_question',
      tags: ['mock', 'space'],
      chosenWords: { noun: 'restaurant', punch_noun: 'great food', reason: 'it had no atmosphere' },
      rating: 2,
      why: 'Classic “no atmosphere” pun.'
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
    template: 'fallback_local',
    tags: ['fallback'],
    chosenWords: {},
    rating: null,
    why: 'Fallback to stored joke because AI generation was unavailable.',
    source: 'fallback',
    persist: false
  }
}

function resolveModelName(responseModel) {
  if (responseModel) {
    return responseModel
  }
  const models = getResponseModels({ stream: false })
  if (models.length > 0) {
    return models[0]
  }
  return 'unknown-model'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  let jokePayload
  let responseModel = null

  try {
    if (openai.__mock) {
      jokePayload = buildMockAiJoke()
      responseModel = 'mock-openai'
    } else {
      const prompt = buildAiJokePrompt()
      const result = await createResponseWithFallback(
        openai,
        {
          input: prompt,
          temperature: 0.8,
          max_output_tokens: 600
        },
        { stream: false }
      )
      const output = sanitizeLine(result?.output_text)
      jokePayload = parseAiJokePayload(output)
      responseModel = result?.model || null
    }
  } catch (error) {
    console.error('[ai-joke] Failed to generate joke from OpenAI, using fallback', error)
    jokePayload = buildFallbackJoke()
    responseModel = 'local-fallback'
  }

  const modelName = resolveModelName(responseModel)
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
      template: jokePayload.template,
      tags: jokePayload.tags,
      rating: jokePayload.rating,
      chosenWords: jokePayload.chosenWords,
      whyThisIsFunny: jokePayload.why,
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

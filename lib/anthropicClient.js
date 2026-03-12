import Anthropic from '@anthropic-ai/sdk'

let cachedClient = null

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-6'

export function getAnthropicClient() {
  if (cachedClient) return cachedClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

export function getAnthropicModel() {
  return DEFAULT_MODEL
}

export async function generateWithAnthropic(prompt) {
  const client = getAnthropicClient()
  if (!client) throw new Error('ANTHROPIC_API_KEY is not configured')

  const seed = Math.random().toString(36).slice(2, 10)
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 300,
    temperature: 1,
    system: `You are a creative dad joke writer. Session: ${seed}`,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content.find((b) => b.type === 'text')?.text || ''
  return { output_text: text, model: response.model }
}

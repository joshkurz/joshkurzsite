import { getAiJokeNickname } from '../../lib/aiJokeNicknames'

describe('getAiJokeNickname', () => {
  it('returns the same nickname for identical model and prompt combinations', () => {
    const first = getAiJokeNickname('gpt-4o', '2024-07-01')
    const second = getAiJokeNickname('gpt-4o', '2024-07-01')
    expect(second).toBe(first)
  })

  it('normalizes casing so model and prompt variations share the same nickname', () => {
    const lower = getAiJokeNickname('gpt-4o', 'v1')
    const mixed = getAiJokeNickname('GPT-4O', 'V1')
    expect(mixed).toBe(lower)
  })

  it('does not leak the underlying model or prompt identifiers in the nickname', () => {
    const nickname = getAiJokeNickname('gpt-4o', '2024-07-01')
    expect(nickname.toLowerCase()).not.toContain('gpt-4o')
    expect(nickname).not.toContain('2024-07-01')
  })
})

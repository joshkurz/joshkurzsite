const PREDEFINED_NICKNAMES = {
  // Intentionally left empty so future tweaks can pin specific nicknames.
}

const ADJECTIVES = [
  'Giggle',
  'Groan',
  'Snicker',
  'Chuckle',
  'Quip',
  'Punny',
  'Jolly',
  'Witty',
  'Sprightly',
  'Cheeky',
  'Zany',
  'Droll'
]

const NOUNS = [
  'Gadget',
  'Gremlin',
  'Rocket',
  'Golem',
  'Anvil',
  'Sprocket',
  'Juggler',
  'Yodel',
  'Bandit',
  'Moose',
  'Noodle',
  'Nimbus',
  'Rascal'
]

const SUFFIXES = [
  'Express',
  'Factory',
  'Depot',
  'Deluxe',
  'Prime',
  '9000',
  'Bazaar',
  'Workshop',
  'Station',
  'Outpost',
  'Fountain'
]

function computeHash(value) {
  const input = value || ''
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index)
    hash |= 0
  }
  return hash
}

function selectFromList(list, hash, salt) {
  if (!Array.isArray(list) || list.length === 0) {
    return ''
  }
  const salted = Math.imul(hash, 31) ^ Math.imul(salt, 2654435761)
  const index = ((salted % list.length) + list.length) % list.length
  return list[index]
}

function normalizeModelName(modelName) {
  if (!modelName) {
    return 'mystery-model'
  }
  return String(modelName).trim() || 'mystery-model'
}

function normalizePromptVersion(promptVersion) {
  if (promptVersion === undefined || promptVersion === null) {
    return '0'
  }
  const normalized = String(promptVersion).trim()
  return normalized || '0'
}

function buildNickname(modelName, promptVersion) {
  const baseModel = normalizeModelName(modelName)
  const baseVersion = normalizePromptVersion(promptVersion)
  const key = `${baseModel.toLowerCase()}::${baseVersion}`
  if (PREDEFINED_NICKNAMES[key]) {
    return PREDEFINED_NICKNAMES[key]
  }

  const signature = `${baseModel}::${baseVersion}`
  const hash = computeHash(signature)
  const adjective = selectFromList(ADJECTIVES, hash, 7)
  const noun = selectFromList(NOUNS, hash, 17)
  const suffix = selectFromList(SUFFIXES, hash, 29)
  const funParts = [adjective, noun, suffix].filter(Boolean)
  const funName = funParts.join(' ')
  const descriptorParts = [baseModel, `Prompt v${baseVersion}`]
  return `${funName} (${descriptorParts.join(' · ')})`
}

export function getAiJokeNickname(modelName, promptVersion) {
  return buildNickname(modelName, promptVersion)
}

export function parseAiAuthorSignature(author) {
  if (!author || typeof author !== 'string') {
    return null
  }
  const match = author.match(/^(.*?)\s*·\s*AI Joke Prompt v([\w.-]+)/i)
  if (!match) {
    return null
  }
  const model = match[1] ? match[1].trim() : ''
  const promptVersion = match[2] ? match[2].trim() : ''
  if (!model || !promptVersion) {
    return null
  }
  return { model, promptVersion }
}

export function resolveNicknameFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }
  const nickname = typeof metadata.nickname === 'string' ? metadata.nickname.trim() : ''
  if (nickname) {
    return nickname
  }
  const model = metadata.model ? String(metadata.model).trim() : ''
  const promptVersion = metadata.promptVersion ? String(metadata.promptVersion).trim() : ''
  if (!model || !promptVersion) {
    return null
  }
  return getAiJokeNickname(model, promptVersion)
}

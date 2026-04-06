import { isNsfw } from '../../lib/nsfwFilter'

describe('isNsfw', () => {
  // ── Safe inputs ──────────────────────────────────────────────────────────

  it('returns false for a clean dad joke', () => {
    expect(isNsfw('Why did the scarecrow win an award? Because he was outstanding in his field!')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isNsfw('')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isNsfw(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isNsfw(undefined)).toBe(false)
  })

  // ── Word-boundary false-positive guards ──────────────────────────────────

  it('does not flag "classic" (contains "ass" as substring)', () => {
    expect(isNsfw('That was a classic joke')).toBe(false)
  })

  it('does not flag "grass"', () => {
    expect(isNsfw('The grass is always greener')).toBe(false)
  })

  it('does not flag "cockroach"', () => {
    expect(isNsfw('There was a cockroach in the kitchen')).toBe(false)
  })

  it('does not flag "cocktail"', () => {
    expect(isNsfw('He ordered a cocktail')).toBe(false)
  })

  it('does not flag "analysis"', () => {
    expect(isNsfw('After careful analysis, the joke was terrible')).toBe(false)
  })

  it('does not flag "scum" (contains "cum" as substring)', () => {
    expect(isNsfw('The scum of the earth')).toBe(false)
  })

  // ── Profanity detection ──────────────────────────────────────────────────

  it('flags text containing "fuck"', () => {
    expect(isNsfw('what the fuck')).toBe(true)
  })

  it('flags "fucking" (prefix match)', () => {
    expect(isNsfw('That was fucking terrible')).toBe(true)
  })

  it('flags "shit"', () => {
    expect(isNsfw('That joke is shit')).toBe(true)
  })

  it('flags "ass" as a standalone word', () => {
    expect(isNsfw('Kick his ass')).toBe(true)
  })

  it('flags "bitch"', () => {
    expect(isNsfw('You son of a bitch')).toBe(true)
  })

  // ── Sexual content ────────────────────────────────────────────────────────

  it('flags "sex"', () => {
    expect(isNsfw('the joke is about sex')).toBe(true)
  })

  it('flags "sexy"', () => {
    expect(isNsfw('that is sexy')).toBe(true)
  })

  it('flags "sexual"', () => {
    expect(isNsfw('sexual content')).toBe(true)
  })

  it('flags "bisexual"', () => {
    expect(isNsfw('he is bisexual')).toBe(true)
  })

  it('flags "cock" as a standalone word', () => {
    expect(isNsfw('He grabbed his cock')).toBe(true)
  })

  it('flags "dick" as a standalone word', () => {
    expect(isNsfw('Don\'t be a dick')).toBe(true)
  })

  it('flags "pussy"', () => {
    expect(isNsfw('Don\'t be such a pussy')).toBe(true)
  })

  it('flags "cum" as a standalone word', () => {
    expect(isNsfw('He started to cum')).toBe(true)
  })

  it('flags "penis"', () => {
    expect(isNsfw('He exposed his penis')).toBe(true)
  })

  it('flags "vagina"', () => {
    expect(isNsfw('vagina joke here')).toBe(true)
  })

  it('flags "boobs"', () => {
    expect(isNsfw('Nice boobs')).toBe(true)
  })

  it('flags "tits"', () => {
    expect(isNsfw('Check out her tits')).toBe(true)
  })

  it('flags "porn"', () => {
    expect(isNsfw('He was watching porn')).toBe(true)
  })

  it('flags "masturbating" (prefix match on masturbat)', () => {
    expect(isNsfw('caught him masturbating')).toBe(true)
  })

  it('flags "blowjob"', () => {
    expect(isNsfw('she gave him a blowjob')).toBe(true)
  })

  // ── Slurs ────────────────────────────────────────────────────────────────

  it('flags the n-word', () => {
    expect(isNsfw('used the n-word nigger here')).toBe(true)
  })

  it('flags "faggot"', () => {
    expect(isNsfw('called him a faggot')).toBe(true)
  })

  // ── Abuse ────────────────────────────────────────────────────────────────

  it('flags "rape"', () => {
    expect(isNsfw('joke about rape')).toBe(true)
  })

  it('flags "molested"', () => {
    expect(isNsfw('he molested someone')).toBe(true)
  })

  it('flags "pedophile" (prefix match on pedophil)', () => {
    expect(isNsfw('he is a pedophile')).toBe(true)
  })

  // ── Case insensitivity ───────────────────────────────────────────────────

  it('flags uppercase variants', () => {
    expect(isNsfw('WHAT THE FUCK')).toBe(true)
  })

  it('flags mixed-case variants', () => {
    expect(isNsfw('What The Fuck')).toBe(true)
  })
})

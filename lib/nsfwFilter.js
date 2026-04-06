// lib/nsfwFilter.js
// Word-boundary-aware NSFW detection for joke content.
// Flagged jokes are stored in DynamoDB for admin review — users never see them.

// Most terms use \b on both sides to avoid false positives inside longer words
// (e.g. /\bass\b/ won't fire on "classic" or "grass").
// Prefix-only patterns (masturbat, pedophil, blowjob, handjob) catch common
// conjugations without needing an exhaustive list of variants.
const NSFW_REGEX = new RegExp(
  [
    // Profanity
    '\\bfuck',
    '\\bshit\\b',
    '\\bcunt\\b',
    '\\bbitch\\b',
    '\\bass\\b',
    '\\barse\\b',
    // Sexual
    '\\bsex',
    'bisexual',
    '\\bcock\\b',
    '\\bdick\\b',
    '\\bpussy\\b',
    '\\bcum\\b',
    '\\bjizz\\b',
    '\\bpenis\\b',
    '\\bvagina\\b',
    '\\bdildo\\b',
    '\\bboob',
    '\\btits?\\b',
    '\\bporn\\b',
    '\\bhorny\\b',
    '\\borgasm\\b',
    '\\bboner\\b',
    '\\banal\\b',
    'masturbat',
    'blowjob',
    'handjob',
    // Slurs
    '\\bnigger\\b',
    '\\bnigga\\b',
    '\\bfaggot\\b',
    '\\bfag\\b',
    // Abuse
    '\\brape\\b',
    '\\bmolest',
    'pedophil',
  ].join('|'),
  'i'
)

/**
 * Returns true if the given text contains NSFW content.
 * Designed for speed — synchronous, no external calls.
 */
export function isNsfw(text) {
  if (!text || typeof text !== 'string') return false
  return NSFW_REGEX.test(text)
}

import { randomInt } from 'crypto';

const topics = [
  'tax season',
  'in-laws',
  'dating apps',
  'reality TV',
  'midlife crisis',
  'office politics',
  'bad Wi-Fi',
  'grocery prices',
  'group chats',
  'cryptocurrency',
  'conspiracy theories',
  'hangovers',
  'DIY disasters',
  'meetings that could be emails',
  'small talk at weddings',
  'crowded subways',
  'online shopping carts',
  'student loans',
  'gym memberships',
  'food delivery mishaps',
  'social media influencers',
  'internet trolls',
  'road trips with kids',
  'late-night infomercials',
  'pet obsessions'
];

const objects = [
  'cheap wine',
  'air fryer',
  'velcro sneakers',
  'karaoke machine',
  'flask',
  'selfie stick',
  'fidget spinner',
  'fake ID',
  'stress ball',
  'scented candle',
  'rubber chicken',
  'hot sauce',
  'skateboard',
  'tattoo',
  'smartphone',
  'pajama pants',
  'boombox',
  'skylight'
];

const devices = [
  'a sarcastic tag',
  'the rule of three',
  'a spicy callback',
  'an exaggerated comparison'
];

const comedians = [
  'Bernie Mac',
  'Dave Chappelle',
  'Ali Wong',
  'Chris Rock',
  'Joan Rivers',
  'Richard Pryor',
  'Wanda Sykes'
];

const templates = [
  ({ topic, extras, device, comedian }) =>
    `Write a quick, edgy joke about ${topic} with the energy of ${comedian}. Work in ${extras[0]} and ${extras[1]}, flipping expectations with ${device}. Keep it playful and PG-13, and don't mention any comedians by name.`,
  ({ topic, extras, device, comedian }) =>
    `In the style of ${comedian}, deliver a bold one-liner on ${topic} that sneaks in ${extras.join(', ')} and ends with ${device}. Keep it playful and PG-13, and avoid referencing the comedian.`,
  ({ topic, extras, device, comedian }) =>
    `Channel the vibe of ${comedian} roasting ${topic}. Drop in ${extras[2]} somewhere and hit the crowd with ${device}. Keep it playful and PG-13 without naming any comedians.`
];

function pick(arr) {
  return arr[randomInt(arr.length)];
}

function pickUnique(arr, count) {
  const chosen = new Set();
  while (chosen.size < count) {
    chosen.add(pick(arr));
  }
  return Array.from(chosen);
}

export function generatePrompt() {
  const topic = pick(topics);
  const extras = pickUnique(objects, 3);
  const device = pick(devices);
  const comedian = pick(comedians);
  const template = pick(templates);
  return [
    template({ topic, extras, device, comedian }),
    'Avoid using special characters or symbols; respond with plain text only.',
    'Do not mention any comedians by name.',
    'Return the joke on exactly two lines labeled like:',
    'Question: <setup>',
    'Answer: <punchline>'
  ].join('\n');
}

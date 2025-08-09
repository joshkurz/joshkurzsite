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
    `Roast ${topic} with a groan-worthy dad joke in the spirit of ${comedian}. Work in ${extras[0]} and ${extras[1]} and use ${device} to link the punchline back to the setup. Keep it playful and PG-13 without naming any comedians.`,
  ({ topic, extras, device, comedian }) =>
    `In the style of ${comedian}, craft a roasting dad joke about ${topic} that sneaks in ${extras.join(', ')} and lands with ${device}. Make sure the punchline clearly connects to the setup. Keep it PG-13 and skip naming the comedian.`,
  ({ topic, extras, device, comedian }) =>
    `Channel the energy of ${comedian} to roast ${topic} with a punny dad joke. Slip in ${extras[2]} and finish with ${device} that ties back to the setup. Keep it playful and PG-13 without mentioning any comedians.`
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
    'Make the joke roast the topic in a classic dad-joke style and ensure the punchline clearly relates to the setup.',
    'Do not mention any comedians by name.',
    'Return the joke on exactly two lines labeled like:',
    'Question: <setup>',
    'Answer: <punchline>'
  ].join('\n');
}

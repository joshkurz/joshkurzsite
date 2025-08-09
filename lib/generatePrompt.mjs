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
  'small talk at weddings'
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
    `Channel ${comedian} and craft a quick, edgy joke about ${topic}. Work in ${extras[0]} and ${extras[1]}. Flip expectations with ${device}. Keep it playful and PG-13.`,
  ({ topic, extras, device, comedian }) =>
    `In the voice of ${comedian}, write a bold one-liner on ${topic} that sneaks in ${extras.join(', ')}. Finish with ${device} for the punch. Keep it playful and PG-13.`,
  ({ topic, extras, device, comedian }) =>
    `Sound like ${comedian} doing a short roast about ${topic}. Mention ${extras[2]} somewhere and hit the crowd with ${device}. Keep it playful and PG-13.`
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
    'Return the joke on exactly two lines labeled like:',
    'Question: <setup>',
    'Answer: <punchline>'
  ].join('\n');
}

import { randomInt } from 'crypto';
import { getInspirationPromptBlock } from './jokeInspiration.mjs';

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

const angles = [
  'an observational twist on everyday life',
  'a clever play on words that sneaks up on the audience',
  'a gentle self-own that keeps things humble',
  'a comforting family-friendly wink',
  'a classic setup that flips expectations at the end',
  'a warm exaggeration that still feels relatable'
];

const devices = [
  'a callback to the setup',
  'a quick tag that leans into wordplay',
  'a playful exaggerated comparison',
  'a lighthearted misdirection'
];

const comedians = [
  'Jerry Seinfeld',
  'Bernie Mac',
  'Dave Chappelle',
  'Ali Wong',
  'Chris Rock',
  'Jim Gaffigan',
  'Wanda Sykes'
];

const templates = [
  ({ topic, angle, device, comedian }) =>
    `In the spirit of ${comedian}, write a groan-worthy punny dad joke about ${topic}. Let ${angle} guide the setup and use ${device} so the punchline circles back to where it started. Keep it playful, PG-13, and avoid naming any comedians.`,
  ({ topic, angle, device, comedian }) =>
    `Channel the everyday charm of ${comedian} to craft a pun-forward dad joke focused on ${topic}. Lean on ${angle}, rely on ${device} to connect the payoff to the setup, and keep the humor warm rather than roasty.`,
  ({ topic, angle, device, comedian }) =>
    `Make a classic dad joke about ${topic} that would make ${comedian} proud—groan-inducing, pun-heavy, and full of heart. Work in ${angle} and finish with ${device} to keep the whole thing tied together. Keep it PG-13 and skip naming the comedian.`
];

function pick(arr) {
  return arr[randomInt(arr.length)];
}

function mergeWithInspiration(lines) {
  const inspirationBlock = getInspirationPromptBlock();
  if (inspirationBlock) {
    return [inspirationBlock, ...lines].join('\n');
  }
  return lines.join('\n');
}

function buildDailyPrompt(event) {
  const {
    year,
    text,
    title,
    summary,
    source,
    comedicAngle,
    selectionReason
  } = event;
  const description = summary || text || title;
  const sourceLine = source ? `Use this reference for context: ${source}.` : '';
  const angleLine = comedicAngle
    ? `Lean into this comedic angle: ${comedicAngle}.`
    : selectionReason
    ? `Let this reasoning guide your humor: ${selectionReason}.`
    : '';
  return mergeWithInspiration([
    'Craft a dad joke that feels timely for today. Use the details below as inspiration and weave them into the setup or punchline in a playful way:',
    `Event: ${description}`,
    year ? `Happened in: ${year}` : '',
    title && !description.includes(title) ? `Title: ${title}` : '',
    sourceLine,
    angleLine,
    'Keep it gentle: skip heavy topics like war, tragedy, disasters, or illness and lean into light, everyday humor.',
    'Keep the humor groan-worthy but warm-hearted, and make sure the joke makes it clear why the event or date matters.',
    'Avoid using special characters or symbols; respond with plain text only.',
    'Return the joke on exactly two lines labeled like:',
    'Question: <setup>',
    'Answer: <punchline>'
  ]
    .filter(Boolean));
}

export function generatePrompt(options = {}) {
  if (options.mode === 'daily' && options.event) {
    return buildDailyPrompt(options.event);
  }
  const topic = pick(topics);
  const angle = pick(angles);
  const device = pick(devices);
  const comedian = pick(comedians);
  const template = pick(templates);
  return mergeWithInspiration([
    template({ topic, angle, device, comedian }),
    'Avoid using special characters or symbols; respond with plain text only.',
    'Keep the humor pun-forward, groan-inducing, and good-natured rather than a roast.',
    'Do not mention or allude to sensitive topics (war, violence, illness, disasters, politics, tragedy, etc.); keep it lighthearted.',
    'Make sure the punchline clearly relates back to the setup and stays focused on that single topic.',
    'Do not mention any comedians by name.',
    'Return the joke on exactly two lines labeled like:',
    'Question: <setup>',
    'Answer: <punchline>'
  ]);
}

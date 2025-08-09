import { randomInt } from 'crypto';

const topics = [
  'aardvark', 'astronaut', 'toaster', 'penguin', 'cloud', 'robot', 'cactus',
  'zebra', 'banana', 'violin', 'turtle', 'drone', 'unicorn', 'pizza',
  'submarine', 'lawnmower', 'donut', 'saxophone', 'marshmallow', 'piano'
];

const objects = [
  'hat', 'scooter', 'trombone', 'slinky', 'teapot', 'balloon', 'helmet',
  'backpack', 'harmonica', 'umbrella', 'cookie', 'flashlight', 'notebook',
  'yo-yo', 'snow globe', 'paperclip', 'garden gnome'
];

const devices = [
  'misdirection',
  'the rule of three',
  'a playful pun',
  'an unexpected callback'
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
  return [
    `Write a clean, family-friendly dad joke about a ${topic}.`,
    'Brainstorm a few assumptions and pick the most surprising angle.',
    `Work in the objects ${extras.join(', ')} somewhere in the setup or punchline.`,
    `Twist expectations using ${device}.`,
    'Return the joke on exactly two lines labeled like:',
    'Question: <setup>',
    'Answer: <punchline>'
  ].join('\n');
}

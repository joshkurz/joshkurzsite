import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '../data')

const CATEGORY_KEYWORDS = {
  animals: ['cat', 'dog', 'fish', 'bird', 'bear', 'horse', 'cow', 'pig', 'duck', 'chicken',
    'rabbit', 'frog', 'bee', 'ant', 'snake', 'shark', 'whale', 'monkey', 'deer', 'fox',
    'wolf', 'spider', 'worm', 'turtle', 'parrot', 'penguin', 'owl', 'mouse', 'rat', 'squirrel',
    'hamster', 'goat', 'sheep', 'donkey', 'camel', 'elephant', 'lion', 'tiger', 'giraffe',
    'zebra', 'kangaroo', 'koala', 'dolphin', 'octopus', 'crab', 'lobster', 'alligator',
    'crocodile', 'pony', 'buffalo', 'moose', 'elk', 'cheetah', 'leopard', 'panda', 'gorilla',
    'seagull', 'pigeon', 'pet', 'zoo', 'farm', 'animal', 'puppy', 'kitten', 'hound', 'pup',
    'kitty', 'piglet', 'colt', 'foal', 'cub', 'lamb', 'chick', 'tadpole', 'caterpillar'],
  food: ['eat', 'food', 'pizza', 'burger', 'sandwich', 'bread', 'cheese', 'milk', 'coffee',
    'tea', 'drink', 'fruit', 'vegetable', 'potato', 'tomato', 'apple', 'banana', 'orange',
    'cookie', 'cake', 'pie', 'soup', 'steak', 'restaurant', 'kitchen', 'cook', 'chef',
    'dessert', 'sugar', 'salt', 'pepper', 'butter', 'egg', 'rice', 'pasta', 'spaghetti',
    'taco', 'sushi', 'breakfast', 'lunch', 'dinner', 'meal', 'hungry', 'taste', 'sweet',
    'meat', 'bacon', 'ham', 'sausage', 'pickle', 'lettuce', 'onion', 'garlic', 'mushroom',
    'broccoli', 'carrot', 'lemon', 'lime', 'grape', 'strawberry', 'watermelon', 'pineapple',
    'mango', 'donut', 'muffin', 'pancake', 'waffle', 'cereal', 'bagel', 'pretzel', 'chips',
    'popcorn', 'chocolate', 'candy', 'yogurt', 'honey', 'jam', 'peanut', 'almond', 'cashew',
    'beer', 'wine', 'juice', 'soda', 'lemonade', 'tuna', 'salmon', 'shrimp', 'mustard',
    'ketchup', 'mayo', 'cream', 'flour', 'bake', 'fry', 'grill', 'roast', 'boil', 'thirsty',
    'delicious', 'tasty', 'flavor', 'spicy', 'sour', 'bitter', 'salad', 'sauce', 'dip'],
  science: ['science', 'chemistry', 'biology', 'physics', 'atom', 'molecule', 'electron',
    'proton', 'neutron', 'dna', 'cell', 'evolution', 'gravity', 'element', 'periodic',
    'scientist', 'lab', 'experiment', 'hypothesis', 'theory', 'oxygen', 'carbon', 'hydrogen',
    'nitrogen', 'telescope', 'microscope', 'equation', 'chemical', 'reaction', 'energy',
    'force', 'newton', 'einstein', 'darwin', 'nucleus', 'orbit', 'quantum', 'particle',
    'radiation', 'photon', 'laser', 'magnet', 'mutation', 'gene', 'chromosome', 'protein',
    'enzyme', 'bacteria', 'virus', 'fungi', 'photosynthesis', 'ecosystem', 'species', 'fossil',
    'mineral', 'geology', 'astronomy', 'planet', 'star', 'galaxy', 'universe', 'black hole',
    'comet', 'meteor', 'moon', 'solar', 'algebra', 'calculus', 'geometry', 'math', 'formula',
    'nuclear', 'atomic', 'plasma', 'crystal', 'compound', 'mixture', 'pi', 'prime', 'integer'],
  technology: ['computer', 'phone', 'internet', 'wifi', 'wi-fi', 'code', 'program', 'software',
    'hardware', 'robot', 'artificial', 'machine', 'app', 'website', 'email', 'keyboard',
    'screen', 'monitor', 'server', 'network', 'data', 'algorithm', 'hack', 'tech', 'gadget',
    'device', 'cable', 'battery', 'digital', 'virtual', 'online', 'bluetooth', 'usb', 'drive',
    'processor', 'chip', 'pixel', 'download', 'upload', 'stream', 'cloud', 'database',
    'password', 'browser', 'smartphone', 'tablet', 'laptop', 'printer', 'camera', 'speaker',
    'drone', 'programmer', 'developer', 'debug', 'bug', 'git', 'click', 'scroll', 'swipe',
    'reboot', 'update', 'install', 'firewall', 'encryption', 'selfie', 'touchscreen'],
  sports: ['sport', 'baseball', 'football', 'basketball', 'soccer', 'tennis', 'golf', 'hockey',
    'swimming', 'running', 'race', 'game', 'team', 'player', 'coach', 'ball', 'bat', 'goal',
    'score', 'champion', 'athlete', 'stadium', 'gym', 'exercise', 'workout', 'fitness',
    'training', 'referee', 'foul', 'touchdown', 'home run', 'dunk', 'pitcher', 'quarterback',
    'tackle', 'kick', 'throw', 'catch', 'sprint', 'marathon', 'cycling', 'volleyball',
    'bowling', 'boxing', 'wrestling', 'karate', 'skiing', 'snowboard', 'surfing', 'skateboard',
    'medal', 'trophy', 'championship', 'league', 'tournament', 'playoff', 'field', 'court',
    'track', 'pitch', 'net', 'hoop', 'puck', 'glove', 'helmet', 'jersey', 'serve', 'match',
    'inning', 'lap', 'finish line', 'starting block', 'podium', 'fan', 'cheer'],
  work: ['work', 'job', 'boss', 'office', 'meeting', 'employee', 'manager', 'deadline',
    'salary', 'hire', 'fired', 'career', 'business', 'company', 'project', 'presentation',
    'coworker', 'professional', 'client', 'customer', 'interview', 'resume', 'promotion',
    'raise', 'retire', 'overtime', 'conference', 'report', 'budget', 'profit', 'revenue',
    'invoice', 'contract', 'deal', 'negotiate', 'market', 'stock', 'invest', 'bank', 'money',
    'cash', 'pay', 'wage', 'bonus', 'tax', 'accounting', 'lawyer', 'nurse', 'dentist',
    'plumber', 'electrician', 'mechanic', 'carpenter', 'waiter', 'pilot', 'farmer',
    'construction', 'factory', 'shop', 'sell', 'buy', 'economy', 'startup', 'intern',
    'colleague', 'cubicle', 'commute', 'paycheck', 'unemployment', 'resign', 'quit'],
  school: ['school', 'teacher', 'student', 'class', 'homework', 'test', 'grade', 'study',
    'learn', 'college', 'university', 'library', 'book', 'pencil', 'principal', 'exam', 'quiz',
    'lesson', 'history', 'english', 'geography', 'education', 'graduate', 'diploma', 'degree',
    'lecture', 'essay', 'assignment', 'recess', 'cafeteria', 'classroom', 'chalkboard',
    'whiteboard', 'backpack', 'notebook', 'textbook', 'tutor', 'scholarship', 'dean',
    'semester', 'freshman', 'junior', 'senior', 'kindergarten', 'elementary', 'campus',
    'dormitory', 'professor', 'pupil', 'curriculum', 'detention', 'spelling', 'arithmetic',
    'report card', 'prom', 'graduation', 'recess'],
  weather: ['weather', 'rain', 'snow', 'sun', 'cloud', 'storm', 'thunder', 'lightning', 'fog',
    'wind', 'temperature', 'hot', 'cold', 'warm', 'freeze', 'ice', 'umbrella', 'forecast',
    'season', 'winter', 'summer', 'spring', 'autumn', 'fall', 'sunny', 'rainy', 'snowy',
    'windy', 'cloudy', 'humid', 'tornado', 'hurricane', 'blizzard', 'hail', 'frost', 'dew',
    'mist', 'drizzle', 'flood', 'drought', 'heatwave', 'climate', 'celsius', 'fahrenheit',
    'thermometer', 'meteorologist', 'sleet', 'overcast', 'breezy', 'chilly', 'freezing',
    'scorching', 'muggy', 'arctic', 'tropical', 'rainbow', 'puddle', 'snowflake', 'icicle'],
}

function assignCategory(joke) {
  const text = [joke.opener, joke.response, joke.text]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let bestCategory = null
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}`, 'i').test(text)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestScore > 0 ? bestCategory : null
}

function tagFile(filename) {
  const filePath = join(dataDir, filename)
  const jokes = JSON.parse(readFileSync(filePath, 'utf8'))
  let tagged = 0

  const updated = jokes.map(joke => {
    const category = assignCategory(joke)
    if (category) tagged++
    return { ...joke, category }
  })

  writeFileSync(filePath, JSON.stringify(updated, null, 2))

  const counts = {}
  updated.forEach(j => {
    if (j.category) counts[j.category] = (counts[j.category] || 0) + 1
  })
  console.log(`${filename}: tagged ${tagged}/${jokes.length} jokes`)
  console.log('  Breakdown:', counts)
}

tagFile('fatherhood_jokes.json')
tagFile('external_jokes.json')
console.log('\nDone! Category pages will reflect the new tags on next build.')

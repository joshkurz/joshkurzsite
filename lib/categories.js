// Client-safe category constants — no Node.js imports

export const CATEGORIES = [
  'animals', 'food', 'science', 'technology', 'sports', 'work', 'school', 'weather',
]

export const CATEGORY_META = {
  animals:    { emoji: '🐾', label: 'Animal Jokes',        keywords: 'animal dad jokes, funny animal jokes, cat jokes, dog jokes' },
  food:       { emoji: '🍕', label: 'Food Jokes',          keywords: 'food dad jokes, cooking jokes, pizza jokes, food humor' },
  science:    { emoji: '🔬', label: 'Science Jokes',       keywords: 'science jokes, chemistry jokes, biology jokes, math jokes' },
  technology: { emoji: '💻', label: 'Tech Jokes',          keywords: 'tech jokes, programmer jokes, computer jokes, coding humor' },
  sports:     { emoji: '⚽', label: 'Sports Jokes',        keywords: 'sports dad jokes, baseball jokes, football jokes, sports humor' },
  work:       { emoji: '💼', label: 'Work & Office Jokes', keywords: 'office jokes, work humor, boss jokes, workplace dad jokes' },
  school:     { emoji: '📚', label: 'School Jokes',        keywords: 'school jokes, teacher jokes, homework jokes, student humor' },
  weather:    { emoji: '⛅', label: 'Weather Jokes',       keywords: 'weather jokes, rain jokes, winter jokes, weather humor' },
}

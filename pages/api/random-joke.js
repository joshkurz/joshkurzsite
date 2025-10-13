import { getRandomJoke } from '../../lib/jokesData'

export default function handler(req, res) {
  try {
    const joke = getRandomJoke()
    res.status(200).json({
      id: joke.id,
      opener: joke.opener,
      response: joke.response,
      text: joke.text,
      author: joke.author || null
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load a dad joke' })
  }
}

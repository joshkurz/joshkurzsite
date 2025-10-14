import { getRandomJoke } from '../../lib/jokesData'

export default async function handler(req, res) {
  try {
    const joke = await getRandomJoke()
    res.status(200).json({
      id: joke.id,
      opener: joke.opener,
      response: joke.response,
      text: joke.text,
      author: joke.author || null
    })
  } catch (error) {
    console.error('[random-joke] Failed to load joke', error)
    res.status(500).json({ error: 'Unable to load a dad joke' })
  }
}

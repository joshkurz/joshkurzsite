import { pickRandomJoke, getRequestIp } from '../../lib/randomJoke'

export default async function handler(req, res) {
  try {
    const ip = getRequestIp(req)
    const joke = await pickRandomJoke(ip)
    res.status(200).json(joke)
  } catch (error) {
    res.status(500).json({ error: 'Unable to load a dad joke' })
  }
}

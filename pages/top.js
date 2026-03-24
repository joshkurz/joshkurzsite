import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import Header from '../components/Header'
import styles from '../styles/Top.module.css'
import { getDashboardStats } from '../lib/ratingsStorageDynamo'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/top', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(2)
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function formatAuthorName(name) {
  if (!name) return null
  const trimmed = String(name).trim()
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return null
  if (trimmed.toLowerCase() === 'fatherhood.gov') return 'Fatherhood.gov'
  if (trimmed.toLowerCase() === 'icanhazdadjoke.com') return 'icanhazdadjoke.com'
  if (trimmed.toLowerCase() === 'reddit.com/r/dadjokes') return 'r/dadjokes'
  if (trimmed.toLowerCase().startsWith('ai')) return 'AI Generated'
  return trimmed
}

function getStarRating(average) {
  const fullStars = Math.floor(average)
  const hasHalf = average - fullStars >= 0.5
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)
  return (
    <span className={styles.stars}>
      {'★'.repeat(fullStars)}
      {hasHalf && <span className={styles.halfStar}>★</span>}
      {'☆'.repeat(emptyStars)}
    </span>
  )
}

function rankClass(index) {
  if (index === 0) return styles.gold
  if (index === 1) return styles.silver
  if (index === 2) return styles.bronze
  return ''
}

export default function TopJokes({ jokes, totalRatings, updatedAt, error }) {
  return (
    <div className={styles.container}>
      <Head>
        <title>Top Rated Dad Jokes - Community Hall of Fame</title>
        <meta name="description" content={`The highest-rated dad jokes ranked by community votes. ${jokes.length > 0 ? `${jokes.length} top performers` : 'Community'} voted best from 900+ jokes. Updated in real time.`} />
        <link rel="canonical" href="https://joshkurz.net/top" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://joshkurz.net/top" />
        <meta property="og:title" content="Top Rated Dad Jokes - Community Hall of Fame" />
        <meta property="og:description" content="The highest-rated dad jokes ranked by community votes. See which jokes made people groan the most." />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        {jokes.length > 0 && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Top Rated Dad Jokes",
            "description": "The highest-rated dad jokes ranked by community votes",
            "url": "https://joshkurz.net/top",
            "numberOfItems": jokes.length,
            "itemListElement": jokes.slice(0, 10).map((j, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "item": {
                "@type": "CreativeWork",
                "name": j.joke ? j.joke.slice(0, 80) : `Joke #${i + 1}`,
                "description": j.joke || '',
              }
            }))
          })}} />
        )}
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroLabel}>Hall of Fame</span>
          <h1>Top Rated Dad Jokes</h1>
          <p className={styles.heroSubtitle}>
            The community has spoken. These are the jokes that earned the most groans —
            ranked by average rating from {formatNumber(totalRatings)} total votes.
          </p>
        </section>

        {error && (
          <div className={styles.errorPanel}>
            <p>Couldn&apos;t load the leaderboard right now. Try again in a moment.</p>
          </div>
        )}

        {!error && jokes.length === 0 && (
          <div className={styles.emptyState}>
            <p>No jokes have enough votes yet. <Link href="/" className={styles.link}>Go rate some jokes</Link> to build the leaderboard!</p>
          </div>
        )}

        {!error && jokes.length > 0 && (
          <>
            <ol className={styles.jokeList}>
              {jokes.map((joke, index) => {
                const author = formatAuthorName(joke.author)
                return (
                  <li key={joke.jokeId || index} className={`${styles.jokeCard} ${rankClass(index)}`}>
                    <div className={styles.rank}>
                      <span className={styles.rankNumber}>#{index + 1}</span>
                    </div>
                    <div className={styles.jokeBody}>
                      <p className={styles.jokeText}>{joke.joke || `Joke #${joke.jokeId}`}</p>
                      <div className={styles.jokeMeta}>
                        {getStarRating(joke.average)}
                        <span className={styles.average}>{formatAverage(joke.average)}</span>
                        <span className={styles.votes}>{formatNumber(joke.totalRatings)} votes</span>
                        {author && <span className={styles.author}>{author}</span>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>

            {updatedAt && (
              <p className={styles.updatedAt}>
                Last updated: {new Date(updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
          </>
        )}

        <div className={styles.cta}>
          <p>Think you&apos;ve found a joke worthy of the top spot?</p>
          <Link href="/" className={styles.ctaButton}>Go Vote on More Jokes</Link>
        </div>
      </main>
    </div>
  )
}

TopJokes.propTypes = {
  jokes: PropTypes.arrayOf(PropTypes.shape({
    jokeId: PropTypes.string,
    joke: PropTypes.string,
    average: PropTypes.number,
    totalRatings: PropTypes.number,
    author: PropTypes.string,
  })),
  totalRatings: PropTypes.number,
  updatedAt: PropTypes.string,
  error: PropTypes.bool,
}

TopJokes.defaultProps = {
  jokes: [],
  totalRatings: 0,
  updatedAt: null,
  error: false,
}

export async function getStaticProps() {
  try {
    const summary = await getDashboardStats()
    const jokes = (summary?.topPerformers || []).filter(
      (j) => j.mode !== 'daily' && j.joke
    )
    return {
      props: {
        jokes,
        totalRatings: summary?.totals?.overallRatings || 0,
        updatedAt: new Date().toISOString(),
        error: false,
      },
      revalidate: 3600, // ISR: rebuild at most once per hour
    }
  } catch {
    return {
      props: { jokes: [], totalRatings: 0, updatedAt: null, error: true },
      revalidate: 60,
    }
  }
}

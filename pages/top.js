import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import Header from '../components/Header'
import styles from '../styles/Top.module.css'
import { getTopJokes, readGlobalStats } from '../lib/ratingsStorageDynamo'

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
  const topJoke = jokes[0] || null
  const metaDescription = topJoke
    ? `The ${jokes.length} best dad jokes ranked by real community votes. #1: "${topJoke.joke?.slice(0, 80)}..." — rated ${topJoke.average?.toFixed(2)} stars from ${formatNumber(totalRatings)} total ratings.`
    : `The best dad jokes ranked by real community votes. ${formatNumber(totalRatings)} ratings cast across 900+ jokes. Updated live.`

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://joshkurz.net/" },
          { "@type": "ListItem", "position": 2, "name": "Top Dad Jokes", "item": "https://joshkurz.net/top" }
        ]
      },
      {
        "@type": "ItemList",
        "name": `Top ${jokes.length} Dad Jokes Ranked by Community Votes`,
        "description": "The highest-rated dad jokes from 900+ in the collection, ranked by average star rating with a minimum of 3 votes.",
        "url": "https://joshkurz.net/top",
        "numberOfItems": jokes.length,
        "itemListElement": jokes.map((j, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "item": {
            "@type": "CreativeWork",
            "name": j.joke ? j.joke.slice(0, 110) : `Dad Joke #${i + 1}`,
            "description": j.joke || '',
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": j.average,
              "ratingCount": j.totalRatings,
              "bestRating": 5,
              "worstRating": 1
            }
          }
        }))
      }
    ]
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>{`Top ${jokes.length} Dad Jokes Ranked by Community Votes | JoshKurz.net`}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href="https://joshkurz.net/top" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://joshkurz.net/top" />
        <meta property="og:title" content={`Top ${jokes.length} Dad Jokes Ranked by Community Votes`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta property="og:image" content="https://joshkurz.net/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://joshkurz.net/og-image.png" />
        <meta name="twitter:title" content={`Top ${jokes.length} Dad Jokes Ranked by Community Votes`} />
        <meta name="twitter:description" content={metaDescription} />
        {jokes.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        )}
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroLabel}>Hall of Fame</span>
          <h1>Top {jokes.length} Dad Jokes</h1>
          <p className={styles.heroSubtitle}>
            Community-ranked from {formatNumber(totalRatings)} real votes across 900+ jokes.
            Only jokes with at least 3 ratings qualify — no flukes, just proven groan-worthy gold.
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

export async function getServerSideProps() {
  try {
    const [jokes, globalStats] = await Promise.all([
      getTopJokes(25),
      readGlobalStats(),
    ])
    return {
      props: {
        jokes,
        totalRatings: globalStats.totalRatings || 0,
        updatedAt: new Date().toISOString(),
        error: false,
      },
    }
  } catch {
    return {
      props: { jokes: [], totalRatings: 0, updatedAt: null, error: true },
    }
  }
}

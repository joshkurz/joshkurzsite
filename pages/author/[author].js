import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import Header from '../../components/Header'
import styles from '../../styles/Author.module.css'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/speak', label: 'Speak' },
  { href: '/dashboard', label: 'Dashboard' }
]

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  return Number(value).toFixed(2)
}

function formatAuthorName(name) {
  if (!name) return 'Unknown Author'
  const trimmed = String(name).trim()
  if (!trimmed) return 'Unknown Author'
  const lower = trimmed.toLowerCase()
  if (lower === 'unknown') return 'Unknown Author'
  if (lower === 'fatherhood.gov' || lower === 'fatherhood.com') return 'Fatherhood.gov'
  if (lower === 'ai generated' || lower === 'ai') return 'AI Generated'
  return trimmed
}

function getStarRating(average) {
  const fullStars = Math.floor(average)
  const hasHalf = average - fullStars >= 0.5
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)
  return (
    <span className={styles.starRating}>
      {'★'.repeat(fullStars)}
      {hasHalf && <span className={styles.halfStar}>★</span>}
      {'☆'.repeat(emptyStars)}
    </span>
  )
}

function getRankBadge(rank) {
  if (rank === 1) return { className: styles.gold, label: '1st' }
  if (rank === 2) return { className: styles.silver, label: '2nd' }
  if (rank === 3) return { className: styles.bronze, label: '3rd' }
  return { className: '', label: `#${rank}` }
}

export default function AuthorPage({ data, error }) {
  const router = useRouter()

  if (router.isFallback) {
    return <div className={styles.container}>Loading...</div>
  }

  const authorName = formatAuthorName(data?.author)

  return (
    <div className={styles.container}>
      <Head>
        <title>{authorName} - Dad Jokes | Josh Kurz</title>
        <meta name="description" content={`All dad jokes by ${authorName} with ratings and rankings`} />
      </Head>
      <Header navLinks={navLinks} />
      <main className={styles.main}>
        <div className={styles.backLink}>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </div>

        <section className={styles.hero}>
          <span className={styles.heroLabel}>Author Profile</span>
          <h1>{authorName}</h1>
          {!error && data && (
            <p className={styles.heroSubtitle}>
              {formatNumber(data.totalJokes)} jokes with {formatNumber(data.totalRatings)} total ratings
            </p>
          )}
        </section>

        {error && (
          <section className={styles.errorPanel}>
            <p>Unable to load jokes for this author. Please try again later.</p>
          </section>
        )}

        {!error && data && (
          <>
            <section className={styles.statsSection}>
              <div className={styles.statsRow}>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>{formatNumber(data.totalJokes)}</div>
                  <div className={styles.statLabel}>Jokes</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>{formatNumber(data.totalRatings)}</div>
                  <div className={styles.statLabel}>Total Ratings</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>
                    {formatAverage(data.overallAverage)}
                    <span className={styles.statUnit}>★</span>
                  </div>
                  <div className={styles.statLabel}>Avg Rating</div>
                </div>
              </div>
            </section>

            <section className={styles.jokesSection}>
              <h2>All Jokes by {authorName}</h2>
              {data.jokes.length === 0 ? (
                <p className={styles.emptyState}>No rated jokes found for this author.</p>
              ) : (
                <div className={styles.jokesList}>
                  {data.jokes.map((joke) => {
                    const rankBadge = getRankBadge(joke.rank)
                    return (
                      <div
                        key={joke.jokeId}
                        className={`${styles.jokeCard} ${rankBadge.className}`}
                      >
                        <div className={styles.jokeRank}>
                          <span className={styles.rankNumber}>{rankBadge.label}</span>
                        </div>
                        <div className={styles.jokeContent}>
                          <p className={styles.jokeText}>
                            {joke.joke || `Joke #${joke.jokeId}`}
                          </p>
                          <div className={styles.jokeStats}>
                            {getStarRating(joke.average)}
                            <span className={styles.jokeAverage}>{formatAverage(joke.average)}</span>
                            <span className={styles.jokeVotes}>{formatNumber(joke.totalRatings)} votes</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

AuthorPage.propTypes = {
  data: PropTypes.shape({
    author: PropTypes.string,
    totalJokes: PropTypes.number,
    totalRatings: PropTypes.number,
    overallAverage: PropTypes.number,
    jokes: PropTypes.arrayOf(
      PropTypes.shape({
        jokeId: PropTypes.string,
        joke: PropTypes.string,
        author: PropTypes.string,
        totalRatings: PropTypes.number,
        average: PropTypes.number,
        rank: PropTypes.number
      })
    )
  }),
  error: PropTypes.bool
}

AuthorPage.defaultProps = {
  data: null,
  error: false
}

export async function getServerSideProps(context) {
  const { author } = context.params

  if (!author) {
    return { notFound: true }
  }

  try {
    // Build absolute URL for API call
    const protocol = context.req.headers['x-forwarded-proto'] || 'http'
    const host = context.req.headers.host
    const apiUrl = `${protocol}://${host}/api/author-jokes?author=${encodeURIComponent(author)}`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()

    return {
      props: {
        data,
        error: false
      }
    }
  } catch (err) {
    console.error('[author] Error fetching author jokes:', err)
    return {
      props: {
        data: { author, totalJokes: 0, totalRatings: 0, overallAverage: 0, jokes: [] },
        error: true
      }
    }
  }
}

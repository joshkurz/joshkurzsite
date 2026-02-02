import { useRouter } from 'next/router'
import { useState } from 'react'
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

function RatingButtons({ jokeId, jokeText, author, onRated }) {
  const [hoveredRating, setHoveredRating] = useState(null)
  const [userRating, setUserRating] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [ratingResult, setRatingResult] = useState(null)
  const [error, setError] = useState(null)

  const handleClick = async (value) => {
    if (hasSubmitted || isSubmitting) return
    setUserRating(value)
    setHoveredRating(null)
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jokeId,
          rating: value,
          joke: jokeText,
          author: author || undefined
        })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to save rating')
      }
      const data = await response.json()
      setRatingResult(data)
      setHasSubmitted(true)
      if (onRated) onRated(jokeId, data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canInteract = !isSubmitting && !hasSubmitted
  const displayRating = hoveredRating || userRating || 0

  return (
    <div className={styles.ratingSection}>
      <div
        className={styles.groanButtonGroup}
        onMouseLeave={canInteract ? () => setHoveredRating(null) : undefined}
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const isActive = value <= displayRating
          const isSelected = userRating ? value <= userRating : false
          const buttonClass = [
            styles.groanButton,
            isActive ? styles.groanButtonActive : '',
            isSelected ? styles.groanButtonSelected : ''
          ].filter(Boolean).join(' ')

          return (
            <button
              key={value}
              type="button"
              className={buttonClass}
              onClick={() => handleClick(value)}
              disabled={isSubmitting || hasSubmitted}
              aria-label={`${value} groan${value === 1 ? '' : 's'}`}
              onMouseEnter={canInteract ? () => setHoveredRating(value) : undefined}
            >
              <span className={`${styles.groanEmoji} ${isActive ? styles.groanEmojiActive : ''}`}>
                {value <= displayRating ? '🤦' : '🤦‍♂️'}
              </span>
            </button>
          )
        })}
      </div>
      {hasSubmitted && ratingResult && (
        <div className={styles.ratingResult}>
          Avg: {ratingResult.average} ({ratingResult.totalRatings} votes)
        </div>
      )}
      {error && <div className={styles.ratingError}>{error}</div>}
    </div>
  )
}

RatingButtons.propTypes = {
  jokeId: PropTypes.string.isRequired,
  jokeText: PropTypes.string.isRequired,
  author: PropTypes.string,
  onRated: PropTypes.func
}

RatingButtons.defaultProps = {
  author: '',
  onRated: null
}

export default function AuthorPage({ data, error }) {
  const router = useRouter()
  const [ratedJokeIds, setRatedJokeIds] = useState(new Set())

  if (router.isFallback) {
    return <div className={styles.container}>Loading...</div>
  }

  const authorName = formatAuthorName(data?.author)
  const unratedJokes = (data?.unratedJokes || []).filter(j => !ratedJokeIds.has(j.jokeId))

  const handleJokeRated = (jokeId) => {
    setRatedJokeIds(prev => new Set([...prev, jokeId]))
  }

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
                  <div className={styles.statValue}>{formatNumber(data.jokes?.length || 0)}</div>
                  <div className={styles.statLabel}>Rated</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>{formatNumber(unratedJokes.length)}</div>
                  <div className={styles.statLabel}>Unrated</div>
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

            {unratedJokes.length > 0 && (
              <section className={styles.jokesSection}>
                <h2>Unrated Jokes ({unratedJokes.length})</h2>
                <p className={styles.unratedIntro}>Help rate these jokes!</p>
                <div className={styles.jokesList}>
                  {unratedJokes.map((joke) => (
                    <div key={joke.jokeId} className={`${styles.jokeCard} ${styles.unratedCard}`}>
                      <div className={styles.jokeContent}>
                        <p className={styles.jokeText}>
                          {joke.joke || `Joke #${joke.jokeId}`}
                        </p>
                        <RatingButtons
                          jokeId={joke.jokeId}
                          jokeText={joke.joke}
                          author={joke.author}
                          onRated={handleJokeRated}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={styles.jokesSection}>
              <h2>Rated Jokes by {authorName}</h2>
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
    ),
    unratedJokes: PropTypes.arrayOf(
      PropTypes.shape({
        jokeId: PropTypes.string,
        joke: PropTypes.string,
        author: PropTypes.string
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

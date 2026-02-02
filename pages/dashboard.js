import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import Header from '../components/Header'
import styles from '../styles/Dashboard.module.css'
import { getDashboardStats } from '../lib/ratingsStorageDynamo'

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

function formatDate(value) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

function renderRatingCounts(counts = {}) {
  const entries = [1, 2, 3, 4, 5]
  return (
    <dl className={styles.ratingCounts}>
      {entries.map((score) => (
        <div key={score} className={styles.ratingCountRow}>
          <dt>{score}-star</dt>
          <dd>{formatNumber(counts[score] || 0)}</dd>
        </div>
      ))}
    </dl>
  )
}

function getJokeSnippet(joke) {
  if (!joke) {
    return 'No joke text captured for this entry.'
  }
  if (joke.length <= 160) {
    return joke
  }
  return `${joke.slice(0, 157)}...`
}

function formatAuthorName(name) {
  if (!name) {
    return 'Unknown Author'
  }
  const trimmed = String(name).trim()
  if (!trimmed) {
    return 'Unknown Author'
  }
  const lower = trimmed.toLowerCase()
  if (lower === 'unknown') {
    return 'Unknown Author'
  }
  if (lower === 'fatherhood.gov' || lower === 'fatherhood.com') {
    return 'Fatherhood.gov'
  }
  if (lower === 'ai generated' || lower === 'ai') {
    return 'AI Generated'
  }
  return trimmed
}

function formatMode(mode) {
  return mode === 'daily' ? 'Daily' : 'Live'
}

function describePerformer(performer) {
  let description
  if (performer.mode === 'daily') {
    if (performer.date) {
      description = `Daily highlight for ${formatDate(performer.date)}`
    } else {
      description = 'Daily highlight'
    }
  } else {
    description = getJokeSnippet(performer.joke) || performer.jokeId || 'Live joke'
  }
  if (performer.author) {
    return `${description} — ${formatAuthorName(performer.author)}`
  }
  return description
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

function RatingBar({ score, count, maxCount }) {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className={styles.ratingBar}>
      <span className={styles.ratingBarLabel}>{score}★</span>
      <div className={styles.ratingBarTrack}>
        <div
          className={styles.ratingBarFill}
          style={{ width: `${percentage}%` }}
          data-score={score}
        />
      </div>
      <span className={styles.ratingBarCount}>{formatNumber(count)}</span>
    </div>
  )
}

RatingBar.propTypes = {
  score: PropTypes.number.isRequired,
  count: PropTypes.number.isRequired,
  maxCount: PropTypes.number.isRequired
}

function RatingDistributionChart({ counts = {} }) {
  const maxCount = Math.max(...Object.values(counts), 1)
  return (
    <div className={styles.ratingChart}>
      {[5, 4, 3, 2, 1].map((score) => (
        <RatingBar key={score} score={score} count={counts[score] || 0} maxCount={maxCount} />
      ))}
    </div>
  )
}

RatingDistributionChart.propTypes = {
  counts: PropTypes.object
}

export default function Dashboard({ summary, error, requestTimeMs, generatedAt }) {
  const authorStats = summary?.totals?.byAuthor || []
  const topAuthor = authorStats[0] || null
  const authorCount = authorStats.length
  const authorDistributions = summary?.ratingDistribution?.byAuthor || {}
  const topPerformers = summary?.topPerformers || []
  const crowdFavorite = topPerformers[0] || null

  // Calculate sentiment
  const fiveStarCount = summary?.ratingDistribution?.overall?.[5] || 0
  const oneStarCount = summary?.ratingDistribution?.overall?.[1] || 0
  const totalRatings = summary?.totals?.overallRatings || 0
  const positivePercentage = totalRatings > 0 ? Math.round((fiveStarCount / totalRatings) * 100) : 0

  return (
    <div className={styles.container}>
      <Head>
        <title>Dad Jokes Analytics | What Makes People Groan?</title>
      </Head>
      <Header navLinks={navLinks} />
      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroLabel}>Analytics</span>
          <h1>The Science of Dad Jokes</h1>
          <p>
            Which jokes land the biggest groans? Who&apos;s the funniest author? Dive into the data
            behind our joke collection and discover what makes audiences laugh (or cringe).
          </p>
        </section>

        {error && (
          <section className={styles.errorPanel}>
            <p>We weren&apos;t able to load the latest stats. Please try again later.</p>
          </section>
        )}

        {!error && summary && (
          <>
            {/* Story Section: The Big Picture */}
            <section className={styles.storySection}>
              <h2 className={styles.storyTitle}>The Big Picture</h2>
              <div className={styles.statsRow}>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>{formatNumber(summary.totals.overallRatings)}</div>
                  <div className={styles.statLabel}>Total Ratings</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>{formatNumber(summary.totals.uniqueJokes)}</div>
                  <div className={styles.statLabel}>Jokes Rated</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>
                    {formatAverage(summary.totals.overallAverage)}
                    <span className={styles.statUnit}>★</span>
                  </div>
                  <div className={styles.statLabel}>Average Score</div>
                </div>
                <div className={styles.statBox}>
                  <div className={styles.statValue}>{positivePercentage}%</div>
                  <div className={styles.statLabel}>5-Star Ratings</div>
                </div>
              </div>
            </section>

            {/* Story Section: Crowd Favorite */}
            {crowdFavorite && (
              <section className={styles.spotlightSection}>
                <div className={styles.spotlightBadge}>Crowd Favorite</div>
                <blockquote className={styles.spotlightJoke}>
                  &ldquo;{crowdFavorite.joke || 'This joke was so good we forgot to write it down!'}&rdquo;
                </blockquote>
                <div className={styles.spotlightMeta}>
                  <span className={styles.spotlightStars}>{getStarRating(crowdFavorite.average)}</span>
                  <span className={styles.spotlightAvg}>{formatAverage(crowdFavorite.average)} avg</span>
                  <span className={styles.spotlightVotes}>{formatNumber(crowdFavorite.totalRatings)} votes</span>
                  {crowdFavorite.author && (
                    <span className={styles.spotlightAuthor}>by {formatAuthorName(crowdFavorite.author)}</span>
                  )}
                </div>
              </section>
            )}

            {/* Story Section: Rating Breakdown */}
            <section className={styles.storySection}>
              <h2 className={styles.storyTitle}>How Are Jokes Landing?</h2>
              <p className={styles.storyIntro}>
                {positivePercentage > 50
                  ? `Great news! ${positivePercentage}% of all ratings are 5 stars. Our jokes are hitting the mark!`
                  : positivePercentage > 30
                  ? `${positivePercentage}% of ratings hit 5 stars. Room to grow, but we\'re making people smile!`
                  : totalRatings > 0
                  ? `Only ${positivePercentage}% are 5-star ratings. Tough crowd! Let\'s see the breakdown.`
                  : 'No ratings yet. Be the first to judge our jokes!'}
              </p>
              <div className={styles.distributionSection}>
                <div className={styles.distributionMain}>
                  <h3>Overall Distribution</h3>
                  <RatingDistributionChart counts={summary.ratingDistribution.overall} />
                </div>
                {authorStats.length > 0 && (
                  <div className={styles.distributionAuthors}>
                    <h3>By Author</h3>
                    <div className={styles.authorCharts}>
                      {authorStats.slice(0, 3).map((author) => (
                        <div key={author.author} className={styles.authorChart}>
                          <h4>{formatAuthorName(author.author)}</h4>
                          <RatingDistributionChart counts={authorDistributions[author.author]} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Story Section: Leaderboard */}
            {topPerformers.length > 0 && (
              <section className={styles.storySection}>
                <h2 className={styles.storyTitle}>Hall of Fame</h2>
                <p className={styles.storyIntro}>
                  The jokes that earned their place in dad joke history. Ranked by average rating with
                  at least 3 votes.
                </p>
                <div className={styles.leaderboard}>
                  {topPerformers.slice(0, 5).map((performer, index) => (
                    <div
                      key={`${performer.jokeId || index}`}
                      className={`${styles.leaderboardItem} ${index === 0 ? styles.gold : ''} ${index === 1 ? styles.silver : ''} ${index === 2 ? styles.bronze : ''}`}
                    >
                      <div className={styles.leaderboardRank}>#{index + 1}</div>
                      <div className={styles.leaderboardContent}>
                        <p className={styles.leaderboardJoke}>
                          {getJokeSnippet(performer.joke) || `Joke #${performer.jokeId}`}
                        </p>
                        <div className={styles.leaderboardStats}>
                          {getStarRating(performer.average)}
                          <span>{formatAverage(performer.average)}</span>
                          <span className={styles.leaderboardVotes}>{formatNumber(performer.totalRatings)} votes</span>
                          {performer.author && (
                            <span className={styles.leaderboardAuthor}>{formatAuthorName(performer.author)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Story Section: Author Showdown */}
            {authorStats.length > 1 && (
              <section className={styles.storySection}>
                <h2 className={styles.storyTitle}>Author Showdown</h2>
                <p className={styles.storyIntro}>
                  Who&apos;s winning the battle for the best dad jokes? Here&apos;s how our authors stack up.
                </p>
                <div className={styles.authorShowdown}>
                  {authorStats.map((author, index) => (
                    <Link
                      key={author.author}
                      href={`/author/${encodeURIComponent(author.author)}`}
                      className={styles.authorCardLink}
                    >
                      <div className={styles.authorCard}>
                        <div className={styles.authorRank}>#{index + 1}</div>
                        <div className={styles.authorInfo}>
                          <h4>{formatAuthorName(author.author)}</h4>
                          <div className={styles.authorMetrics}>
                            <span>{formatNumber(author.totalRatings)} ratings</span>
                            <span>{getStarRating(author.average)} {formatAverage(author.average)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Activity */}
            <section className={styles.storySection}>
              <h2 className={styles.storyTitle}>Latest Activity</h2>
              <p className={styles.storyIntro}>
                Fresh from the community — see what people are rating right now.
              </p>
              {summary.recentRatings.length === 0 ? (
                <p className={styles.emptyState}>No ratings submitted yet. Be the first!</p>
              ) : (
                <div className={styles.activityFeed}>
                  {summary.recentRatings.slice(0, 10).map((item, index) => (
                    <div key={`${item.jokeId}-${item.submittedAt}-${index}`} className={styles.activityItem}>
                      <div className={styles.activityRating} data-rating={item.rating}>
                        {item.rating}★
                      </div>
                      <div className={styles.activityContent}>
                        <p className={styles.activityJoke}>
                          {item.mode === 'live'
                            ? getJokeSnippet(item.joke) || `Joke ${item.jokeId}`
                            : `Daily feature`}
                        </p>
                        <div className={styles.activityMeta}>
                          <span>{formatDate(item.submittedAt || item.date)}</span>
                          {item.author && <span>{formatAuthorName(item.author)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Debug Stats */}
        <footer className={styles.debugStats}>
          <div className={styles.debugTitle}>Debug Info</div>
          <div className={styles.debugItems}>
            <span>Request: {requestTimeMs}ms</span>
            <span>Generated: {generatedAt}</span>
            <span>Cache: disabled</span>
          </div>
        </footer>
      </main>
    </div>
  )
}

Dashboard.propTypes = {
  summary: PropTypes.shape({
    totals: PropTypes.shape({
      overallRatings: PropTypes.number,
      overallAverage: PropTypes.number,
      uniqueJokes: PropTypes.number,
      ratingCounts: PropTypes.object,
      byAuthor: PropTypes.arrayOf(
        PropTypes.shape({
          author: PropTypes.string,
          totalRatings: PropTypes.number,
          average: PropTypes.number,
          lastRatedAt: PropTypes.string
        })
      )
    }),
    ratingDistribution: PropTypes.shape({
      overall: PropTypes.object,
      byAuthor: PropTypes.object
    }),
    topPerformers: PropTypes.arrayOf(
      PropTypes.shape({
        mode: PropTypes.string,
        jokeId: PropTypes.string,
        joke: PropTypes.string,
        date: PropTypes.string,
        totalRatings: PropTypes.number,
        average: PropTypes.number,
        lastRatedAt: PropTypes.string,
        author: PropTypes.string
      })
    ),
    recentRatings: PropTypes.arrayOf(
      PropTypes.shape({
        jokeId: PropTypes.string,
        mode: PropTypes.string,
        rating: PropTypes.number,
        joke: PropTypes.string,
        submittedAt: PropTypes.string,
        date: PropTypes.string,
        author: PropTypes.string
      })
    )
  }),
  error: PropTypes.bool,
  requestTimeMs: PropTypes.number,
  generatedAt: PropTypes.string
}

Dashboard.defaultProps = {
  summary: null,
  error: false,
  requestTimeMs: 0,
  generatedAt: ''
}

export async function getServerSideProps() {
  const startTime = Date.now()
  try {
    // Call getDashboardStats directly - no caching
    const summary = await getDashboardStats()
    const requestTimeMs = Date.now() - startTime
    const generatedAt = new Date().toISOString()
    return {
      props: {
        summary,
        requestTimeMs,
        generatedAt
      }
    }
  } catch (err) {
    console.error('[dashboard] Unable to load summary', err)
    const requestTimeMs = Date.now() - startTime
    return {
      props: {
        summary: null,
        error: true,
        requestTimeMs,
        generatedAt: new Date().toISOString()
      }
    }
  }
}

import Head from 'next/head'
import PropTypes from 'prop-types'
import Header from '../components/Header'
import styles from '../styles/Dashboard.module.css'
import { summarizeRatings } from '../lib/ratingsStorage'

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

export default function Dashboard({ summary, error }) {
  return (
    <div className={styles.container}>
      <Head>
        <title>Joke Insights Dashboard</title>
      </Head>
      <Header navLinks={navLinks} />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Joke Insights Dashboard</h1>
          <p>
            A quick look at how our daily spotlights and live generated jokes are landing with
            audiences. Dive into top performers, voting trends, and recent activity.
          </p>
        </section>
        {error && (
          <section className={styles.errorPanel}>
            <p>We weren&apos;t able to load the latest stats. Please try again later.</p>
          </section>
        )}
        {!error && summary && (
          <>
            <section className={styles.summaryGrid}>
              <article className={styles.card}>
                <h2>Total Ratings</h2>
                <p className={styles.metric}>{formatNumber(summary.totals.overallRatings)}</p>
                <p className={styles.subtext}>
                  Across {formatNumber(summary.totals.uniqueJokes)} unique joke experiences.
                </p>
              </article>
              <article className={styles.card}>
                <h2>Average Score</h2>
                <p className={styles.metric}>{formatAverage(summary.totals.overallAverage)}</p>
                <p className={styles.subtext}>
                  Live jokes average {formatAverage(summary.totals.live.average)} while daily spotlights
                  average {formatAverage(summary.totals.daily.average)}.
                </p>
              </article>
              <article className={styles.card}>
                <h2>Live Ratings</h2>
                <p className={styles.metric}>{formatNumber(summary.totals.live.totalRatings)}</p>
                <p className={styles.subtext}>Streaming jokes rated in real time.</p>
              </article>
              <article className={styles.card}>
                <h2>Daily Ratings</h2>
                <p className={styles.metric}>{formatNumber(summary.totals.daily.totalRatings)}</p>
                <p className={styles.subtext}>Votes on the curated daily feature.</p>
              </article>
            </section>

            <section className={styles.section}>
              <h2>Rating Distribution</h2>
              <div className={styles.distributionGrid}>
                <article className={styles.card}>
                  <h3>Overall</h3>
                  {renderRatingCounts(summary.ratingDistribution.overall)}
                </article>
                <article className={styles.card}>
                  <h3>Live Jokes</h3>
                  {renderRatingCounts(summary.ratingDistribution.live)}
                </article>
                <article className={styles.card}>
                  <h3>Daily Spotlights</h3>
                  {renderRatingCounts(summary.ratingDistribution.daily)}
                </article>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Top Live Crowd Pleasers</h2>
                <p>
                  Sorted by average rating. We include ties by total vote volume so the true crowd
                  favorites rise to the top.
                </p>
              </div>
              {summary.topLiveJokes.length === 0 ? (
                <p className={styles.emptyState}>No live joke ratings captured yet.</p>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Joke</th>
                        <th>Average</th>
                        <th>Votes</th>
                        <th>Last Rated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topLiveJokes.map((joke) => (
                        <tr key={joke.jokeId}>
                          <td>{getJokeSnippet(joke.joke) || joke.jokeId}</td>
                          <td>{formatAverage(joke.average)}</td>
                          <td>{formatNumber(joke.totalRatings)}</td>
                          <td>{formatDate(joke.lastRatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Daily Spotlight Leaders</h2>
                <p>
                  Which daily feature earned the biggest laughs? A mix of strong averages and solid
                  participation.
                </p>
              </div>
              {summary.topDailyHighlights.length === 0 ? (
                <p className={styles.emptyState}>Daily jokes haven&apos;t been rated yet.</p>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Average</th>
                        <th>Total Votes</th>
                        <th>Daily Votes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topDailyHighlights.map((item) => (
                        <tr key={item.date}>
                          <td>{formatDate(item.date)}</td>
                          <td>{formatAverage(item.average)}</td>
                          <td>{formatNumber(item.totalRatings)}</td>
                          <td>{formatNumber(item.dailyRatings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Most Active Dates</h2>
                <p>The busiest days across both joke modes, with average sentiment for each day.</p>
              </div>
              {summary.highestVolumeDates.length === 0 ? (
                <p className={styles.emptyState}>No voting activity recorded yet.</p>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Total Votes</th>
                        <th>Live Votes</th>
                        <th>Daily Votes</th>
                        <th>Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.highestVolumeDates.map((item) => (
                        <tr key={item.date}>
                          <td>{formatDate(item.date)}</td>
                          <td>{formatNumber(item.totalRatings)}</td>
                          <td>{formatNumber(item.liveRatings)}</td>
                          <td>{formatNumber(item.dailyRatings)}</td>
                          <td>{formatAverage(item.average)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Latest Votes</h2>
                <p>Fresh feedback from the community to keep tabs on how jokes are landing.</p>
              </div>
              {summary.recentRatings.length === 0 ? (
                <p className={styles.emptyState}>No ratings submitted yet.</p>
              ) : (
                <ul className={styles.recentList}>
                  {summary.recentRatings.map((item, index) => (
                    <li key={`${item.jokeId}-${item.submittedAt}-${index}`} className={styles.recentItem}>
                      <div className={styles.recentMeta}>
                        <span className={styles.recentMode}>{item.mode === 'daily' ? 'Daily' : 'Live'}</span>
                        <span>{formatDate(item.submittedAt || item.date)}</span>
                        <span className={styles.recentRating}>{item.rating}★</span>
                      </div>
                      <p className={styles.recentJoke}>
                        {item.mode === 'live'
                          ? getJokeSnippet(item.joke) || `Joke ${item.jokeId}`
                          : `Daily feature for ${formatDate(item.date || item.submittedAt)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
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
      live: PropTypes.shape({
        totalRatings: PropTypes.number,
        average: PropTypes.number
      }),
      daily: PropTypes.shape({
        totalRatings: PropTypes.number,
        average: PropTypes.number
      })
    }),
    ratingDistribution: PropTypes.shape({
      overall: PropTypes.object,
      live: PropTypes.object,
      daily: PropTypes.object
    }),
    topLiveJokes: PropTypes.arrayOf(
      PropTypes.shape({
        jokeId: PropTypes.string,
        joke: PropTypes.string,
        totalRatings: PropTypes.number,
        average: PropTypes.number,
        lastRatedAt: PropTypes.string
      })
    ),
    topDailyHighlights: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string,
        totalRatings: PropTypes.number,
        average: PropTypes.number,
        dailyRatings: PropTypes.number
      })
    ),
    highestVolumeDates: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string,
        totalRatings: PropTypes.number,
        liveRatings: PropTypes.number,
        dailyRatings: PropTypes.number,
        average: PropTypes.number
      })
    ),
    recentRatings: PropTypes.arrayOf(
      PropTypes.shape({
        jokeId: PropTypes.string,
        mode: PropTypes.string,
        rating: PropTypes.number,
        joke: PropTypes.string,
        submittedAt: PropTypes.string,
        date: PropTypes.string
      })
    )
  }),
  error: PropTypes.bool
}

Dashboard.defaultProps = {
  summary: null,
  error: false
}

export async function getServerSideProps() {
  try {
    const summary = await summarizeRatings()
    return { props: { summary } }
  } catch (err) {
    console.error('[dashboard] Unable to load summary', err)
    return { props: { summary: null, error: true } }
  }
}

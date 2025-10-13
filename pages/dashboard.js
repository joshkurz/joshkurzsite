import Head from 'next/head'
import PropTypes from 'prop-types'
import Header from '../components/Header'
import styles from '../styles/Dashboard.module.css'
import { loadDashboardSummary } from '../lib/dashboardSummary'

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

function formatMode(mode) {
  return mode === 'daily' ? 'Daily' : 'Live'
}

function describePerformer(performer) {
  if (performer.mode === 'daily') {
    if (performer.date) {
      return `Daily highlight for ${formatDate(performer.date)}`
    }
    return 'Daily highlight'
  }
  return getJokeSnippet(performer.joke) || performer.jokeId || 'Live joke'
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
            A streamlined look at how daily spotlights and live generated jokes are landing with
            audiences. Track the big totals, distribution trends, top highlights, and the latest
            feedback without wading through extra tables.
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
                <h2>Top Performers</h2>
                <p>High-scoring jokes and highlights ranked by average rating and vote volume.</p>
              </div>
              {summary.topPerformers.length === 0 ? (
                <p className={styles.emptyState}>
                  We need a few more votes before top performers can be determined.
                </p>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Mode</th>
                        <th>Highlight</th>
                        <th>Average</th>
                        <th>Votes</th>
                        <th>Last Rated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.topPerformers.map((performer) => (
                        <tr key={`${performer.mode}-${performer.jokeId || performer.date || 'unknown'}`}>
                          <td>{formatMode(performer.mode)}</td>
                          <td>{describePerformer(performer)}</td>
                          <td>{formatAverage(performer.average)}</td>
                          <td>{formatNumber(performer.totalRatings)}</td>
                          <td>{formatDate(performer.lastRatedAt)}</td>
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
    topPerformers: PropTypes.arrayOf(
      PropTypes.shape({
        mode: PropTypes.string,
        jokeId: PropTypes.string,
        joke: PropTypes.string,
        date: PropTypes.string,
        totalRatings: PropTypes.number,
        average: PropTypes.number,
        lastRatedAt: PropTypes.string
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
    const { summary } = await loadDashboardSummary()
    return { props: { summary } }
  } catch (err) {
    console.error('[dashboard] Unable to load summary', err)
    return { props: { summary: null, error: true } }
  }
}

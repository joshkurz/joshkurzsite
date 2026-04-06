import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import Header from '../components/Header'
import styles from '../styles/WeeklyPage.module.css'
import { getWeeklyTopJokes } from '../lib/ratingsStorageDynamo'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/best-dad-jokes', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

function formatAuthor(author) {
  if (!author) return null
  if (author.toLowerCase() === 'unknown') return null
  if (author === 'fatherhood.gov') return 'Fatherhood.gov'
  if (author === 'icanhazdadjoke.com') return 'icanhazdadjoke.com'
  if (author === 'reddit.com/r/dadjokes') return 'r/dadjokes'
  if (author.toLowerCase().startsWith('ai')) return 'AI Generated'
  return author
}

export default function WeeklyPage({ jokes, updatedAt, error }) {
  const title = 'Best Dad Jokes This Week'
  const description = `The highest-rated dad jokes from the past 7 days — voted on by the community. Updated weekly. ${jokes.length > 0 ? `${jokes.length} jokes made the cut this week.` : ''}`

  return (
    <div className={styles.container}>
      <Head>
        <title>{title} | JoshKurz.net</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://joshkurz.net/weekly" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://joshkurz.net/weekly" />
        <meta property="og:title" content={`${title} | JoshKurz.net`} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta property="og:image" content="https://joshkurz.net/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://joshkurz.net/og-image.png" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroLabel}>Fresh Every Week</span>
          <h1>Best Dad Jokes This Week</h1>
          <p className={styles.heroSubtitle}>
            The community has spoken — these are the highest-rated jokes from the past 7 days.
            Rankings update as votes come in.
          </p>
        </section>

        {error && (
          <div className={styles.emptyState}>
            <p>Couldn&apos;t load this week&apos;s rankings right now. Try again in a moment.</p>
          </div>
        )}

        {!error && jokes.length === 0 && (
          <div className={styles.emptyState}>
            <p>No jokes have been rated in the past 7 days yet. Be the first!</p>
            <Link href="/" className={styles.ctaButton}>Rate Jokes Now</Link>
          </div>
        )}

        {!error && jokes.length > 0 && (
          <ol className={styles.jokeList}>
            {jokes.map((joke, index) => {
              const author = formatAuthor(joke.author)
              return (
                <li key={joke.jokeId} className={styles.jokeCard}>
                  <div className={styles.rank}>
                    <span className={styles.rankNumber}>#{index + 1}</span>
                  </div>
                  <div className={styles.jokeBody}>
                    <p className={styles.jokeText}>{joke.joke || `Joke #${joke.jokeId}`}</p>
                    <div className={styles.jokeMeta}>
                      <span className={styles.average}>⭐ {joke.average}</span>
                      <span className={styles.votes}>{joke.totalRatings} votes this week</span>
                      {author && <span style={{ fontSize: '0.78rem', color: '#f7dc6f' }}>{author}</span>}
                      {joke.jokeId && (
                        <Link href={`/joke/${joke.jokeId}`} className={styles.shareLink}>
                          Share →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {updatedAt && (
          <p className={styles.updatedAt}>
            Last updated: {new Date(updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}

        <div className={styles.cta}>
          <p>See all-time community favorites on the Hall of Fame, or go rate more jokes.</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/best-dad-jokes" className={styles.ctaButton}>All-Time Top Jokes</Link>
            <Link href="/" className={styles.ctaButton} style={{ background: 'transparent', border: '1px solid rgba(243,156,18,0.5)', color: 'var(--color-primary)' }}>Rate Jokes</Link>
          </div>
        </div>
      </main>
    </div>
  )
}

WeeklyPage.propTypes = {
  jokes: PropTypes.arrayOf(PropTypes.shape({
    jokeId: PropTypes.string.isRequired,
    joke: PropTypes.string,
    author: PropTypes.string,
    average: PropTypes.number.isRequired,
    totalRatings: PropTypes.number.isRequired,
  })),
  updatedAt: PropTypes.string,
  error: PropTypes.bool,
}

WeeklyPage.defaultProps = {
  jokes: [],
  updatedAt: null,
  error: false,
}

export async function getStaticProps() {
  try {
    const jokes = await getWeeklyTopJokes()
    return {
      props: {
        jokes,
        updatedAt: new Date().toISOString(),
        error: false,
      },
      revalidate: 3600, // ISR: rebuild at most once per hour
    }
  } catch {
    return {
      props: { jokes: [], updatedAt: null, error: true },
      revalidate: 60,
    }
  }
}

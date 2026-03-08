import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import Header from '../../components/Header'
import ShareButtons from '../../components/ShareButtons'
import styles from '../../styles/JokePage.module.css'
import { getJokeById } from '../../lib/jokesData'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/top', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

export default function JokePage({ joke, shareUrl }) {
  const title = joke.opener ? `"${joke.opener}" — Dad Joke` : 'Dad Joke'
  const description = joke.response
    ? `${joke.opener} … ${joke.response}`
    : joke.text

  return (
    <div className={styles.container}>
      <Head>
        <title>{title} | JoshKurz.net</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <div className={styles.jokeCard}>
          <p className={styles.opener}>{joke.opener}</p>
          {joke.response && <p className={styles.response}>{joke.response}</p>}
          {joke.author && <p className={styles.author}>— {joke.author}</p>}
        </div>

        <ShareButtons jokeId={joke.id} jokeText={joke.text} shareUrl={shareUrl} />

        <div className={styles.cta}>
          <Link href="/" className={styles.ctaButton}>Rate This Joke</Link>
        </div>
      </main>
    </div>
  )
}

JokePage.propTypes = {
  joke: PropTypes.shape({
    id: PropTypes.string.isRequired,
    opener: PropTypes.string.isRequired,
    response: PropTypes.string,
    text: PropTypes.string,
    author: PropTypes.string,
  }).isRequired,
  shareUrl: PropTypes.string.isRequired,
}

export async function getServerSideProps({ params, req }) {
  const joke = getJokeById(params.id)

  if (!joke) {
    return { notFound: true }
  }

  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const shareUrl = `${proto}://${host}/joke/${params.id}`

  return {
    props: { joke, shareUrl },
  }
}

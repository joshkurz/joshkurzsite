import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import styles from '../styles/NotFound.module.css'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/best-dad-jokes', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

const JOKES = [
  {
    setup: "Why couldn't the page be found?",
    punchline: "It was playing hide and URL.",
  },
  {
    setup: "I looked everywhere for this page.",
    punchline: "Guess it really is a 404-gone conclusion.",
  },
  {
    setup: "What did the browser say when it couldn't find the page?",
    punchline: "404-give me, I have no idea where it went.",
  },
  {
    setup: "I tried to find this page for hours.",
    punchline: "Turns out it was never in my browser history — or anyone else's.",
  },
  {
    setup: "Why did the webpage go missing?",
    punchline: "It had too many issues and decided to take a server break.",
  },
  {
    setup: "This page has gone 404-ever.",
    punchline: "And ever. And ever.",
  },
  {
    setup: "What do you call a page that's never coming back?",
    punchline: "404-lorn.",
  },
  {
    setup: "I asked the server where this page went.",
    punchline: "It said it didn't want to talk about it — not found.",
  },
]

export default function NotFound() {
  const [joke, setJoke] = useState(null)

  useEffect(() => {
    setJoke(JOKES[Math.floor(Math.random() * JOKES.length)])
  }, [])

  return (
    <div className={styles.container}>
      <Head>
        <title>404 — Page Not Found | JoshKurz.net</title>
        <meta name="robots" content="noindex" />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <div className={styles.errorCode}>404</div>

        {joke && (
          <div className={styles.jokeCard}>
            <p className={styles.setup}>{joke.setup}</p>
            <p className={styles.punchline}>{joke.punchline}</p>
          </div>
        )}

        <p className={styles.subtitle}>
          The page you&apos;re looking for doesn&apos;t exist — but we&apos;ve got 900+ jokes that do.
        </p>

        <div className={styles.actions}>
          <Link href="/" className={styles.primaryButton}>Take Me Home</Link>
          <Link href="/best-dad-jokes" className={styles.secondaryButton}>Top Jokes</Link>
        </div>
      </main>
    </div>
  )
}

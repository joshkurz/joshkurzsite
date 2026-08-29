import Head from 'next/head'
import Link from 'next/link'
import Header from '../../components/Header'
import styles from '../../styles/GamePage.module.css'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/best-dad-jokes', label: 'Top Jokes' },
  { href: '/community-jokes', label: 'AI vs Human' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
  { href: '/games', label: 'Games' },
]

const TITLE = 'Soccer Brawl — Free Online Soccer Game With No Fouls'
const DESCRIPTION = "Play Soccer Brawl free in your browser — a soccer game where punching and kicking are part of the game, not a foul. No download, no sign-up. My son and I made it together, best played on mobile."
const CANONICAL_URL = 'https://joshkurz.net/games/soccer-brawl'

const faqs = [
  {
    q: 'Can you actually punch and kick other players in this soccer game?',
    a: "Yes — that's the whole rule change. Soccer Brawl plays like a normal match with real scoring and a countdown clock, except punching and kicking opposing players is fair game instead of a foul.",
  },
  {
    q: 'Is Soccer Brawl free to play?',
    a: 'Yes. It runs entirely in your browser — no download, no account, no sign-up. Just open it and play.',
  },
  {
    q: 'Does Soccer Brawl work on mobile?',
    a: "Yes, it's built mobile-first with on-screen KICK and PUNCH buttons and tap-to-move controls. It also works on desktop with keyboard shortcuts.",
  },
  {
    q: 'Is there a foul system, red cards, or referee?',
    a: "No. My son's rule when we designed it was simple: no fouls. Otherwise it's a real match — score more goals than the other team before time runs out.",
  },
  {
    q: 'How do you play — what are the controls?',
    a: 'Tap or click anywhere on the field to run your player there. Tap the KICK or PUNCH buttons to attack — or use X to kick and Z to punch on a keyboard.',
  },
]

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'VideoGame',
      name: 'Soccer Brawl',
      url: CANONICAL_URL,
      description: DESCRIPTION,
      genre: 'Sports',
      applicationCategory: 'Game',
      operatingSystem: 'Any (web browser)',
      isFamilyFriendly: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      author: {
        '@type': 'Person',
        name: 'Josh Kurz',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
}

export default function SoccerBrawl() {
  return (
    <div className={styles.container}>
      <Head>
        <title>{TITLE} | JoshKurz.net</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta property="og:image" content="https://joshkurz.net/games/og-soccer-brawl.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://joshkurz.net/games/og-soccer-brawl.png" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroBadge}>Best on Mobile</span>
          <h1>Soccer Brawl</h1>
          <p className={styles.heroSubtitle}>
            A free online soccer game with no fouls — punching and kicking other players
            is part of the game, not a red card. Made by my son and me.
          </p>
          <a href="/play/soccer-brawl.html" className={styles.playButton}>
            ▶ Play Soccer Brawl Free
          </a>
        </section>

        <section className={styles.section}>
          <h2>The Rules (There Aren&apos;t Many)</h2>
          <p>
            Soccer Brawl started as a project with my son — his rules, not mine. He wanted
            a soccer game where you could actually fight for the ball, so we cut the one rule
            that mattered most: no fouls. Everything else plays like a real match — score
            keeping, a countdown clock, full control of your player up and down the field.
            You just don&apos;t get carded for throwing a punch to win the ball back.
          </p>
        </section>

        <section className={styles.section}>
          <h2>How to Play</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepIcon}>👆</span>
              <p><strong>Move:</strong> Tap or click anywhere on the field and your player runs there.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepIcon}>⚽</span>
              <p><strong>Kick:</strong> Tap the KICK button (or press X on a keyboard) to strike the ball or an opponent.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepIcon}>👊</span>
              <p><strong>Punch:</strong> Tap the PUNCH button (or press Z on a keyboard) to knock a defender out of the way.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepIcon}>🏆</span>
              <p><strong>Win:</strong> Score more goals than the away team before the clock runs out.</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>FAQ</h2>
          <dl className={styles.faqList}>
            {faqs.map(({ q, a }) => (
              <div className={styles.faqItem} key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className={styles.cta}>
          <p>No download, no sign-up — just kickoff.</p>
          <a href="/play/soccer-brawl.html" className={styles.playButton}>
            ▶ Play Soccer Brawl Free
          </a>
          <Link href="/games" style={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.9rem' }}>
            ← Back to all games
          </Link>
        </div>
      </main>
    </div>
  )
}

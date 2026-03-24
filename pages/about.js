import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import styles from '../styles/About.module.css'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/top', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

const features = [
  {
    icon: '🎲',
    title: 'Random Joke Machine',
    description: 'Every visit serves a fresh joke pulled from 900+ dad jokes sourced from fatherhood.gov, icanhazdadjoke.com, Reddit\'s r/dadjokes, and community submissions.',
  },
  {
    icon: '⭐',
    title: 'Community Voting',
    description: 'Rate every joke on a 1–5 groan scale. Ratings are tallied in real time and influence the community leaderboard. Your vote actually counts.',
  },
  {
    icon: '🤖',
    title: 'AI Joke Generation',
    description: 'Hit the AI button and a large language model generates a brand-new dad joke on the spot, inspired by the highest-rated jokes in the collection.',
  },
  {
    icon: '🔊',
    title: 'Text-to-Speech',
    description: 'Every joke has a listen button. AI-powered text-to-speech reads the joke aloud — perfect for sharing at the dinner table without staring at your phone.',
  },
  {
    icon: '✍️',
    title: 'Submit Your Own',
    description: 'Think you\'ve got a great dad joke? Submit it. Approved jokes join the main rotation and are open for community voting.',
  },
  {
    icon: '📊',
    title: 'Analytics Dashboard',
    description: 'See which jokes rank highest, which sources produce the best groaners, and how the community\'s taste in bad humor evolves over time.',
  },
]

const sources = [
  { name: 'fatherhood.gov', description: 'The official U.S. government dad joke archive. Classic, clean, wholesome.' },
  { name: 'icanhazdadjoke.com', description: 'The internet\'s largest dad joke API — hundreds of community-contributed puns.' },
  { name: 'reddit.com/r/dadjokes', description: 'Top all-time posts from the most upvoted dad joke community on Reddit.' },
  { name: 'Community', description: 'Jokes submitted directly by visitors to this site.' },
]

export default function About() {
  return (
    <div className={styles.container}>
      <Head>
        <title>About - Dad Jokes Website | JoshKurz.net</title>
        <meta name="description" content="Learn about JoshKurz.net's interactive dad joke platform — 900+ jokes from 4 sources, community voting, AI generation, and text-to-speech. Built for dad joke science." />
        <link rel="canonical" href="https://joshkurz.net/about" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://joshkurz.net/about" />
        <meta property="og:title" content="About - Dad Jokes Website | JoshKurz.net" />
        <meta property="og:description" content="900+ dad jokes, community voting, AI generation, and text-to-speech. Learn how the platform works." />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroLabel}>About</span>
          <h1>The Dad Joke Science Lab</h1>
          <p className={styles.heroSubtitle}>
            A community-driven platform for rating, submitting, and generating the world&apos;s
            most groan-worthy jokes — built by <a href="https://github.com/joshkurz" className={styles.link}>Josh Kurz</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What Is This?</h2>
          <p>
            JoshKurz.net is an interactive dad jokes website that goes beyond a simple joke list.
            It&apos;s a living, voting platform where the community decides which jokes are truly legendary
            and which ones deserve exactly one reluctant groan.
          </p>
          <p>
            With over 900 jokes sourced from four different sources — and AI generation to mint new ones
            on demand — there&apos;s always something fresh to rate. Whether you&apos;re a dad joke
            connoisseur or just here to suffer through a few puns, you&apos;re in the right place.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Features</h2>
          <div className={styles.featureGrid}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>Where Do the Jokes Come From?</h2>
          <p>Jokes are sourced from four places and rotated fairly so every source gets equal airtime:</p>
          <div className={styles.sourceList}>
            {sources.map((s) => (
              <div key={s.name} className={styles.sourceCard}>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2>How Voting Works</h2>
          <p>
            Each joke is rated on a 1–5 scale. Ratings are stored in AWS DynamoDB and aggregated
            in real time. The <Link href="/dashboard" className={styles.link}>Dashboard</Link> shows
            which jokes have earned the most groans, which sources produce the best material, and
            how the community&apos;s collective taste shakes out.
          </p>
          <p>
            To keep votes honest, each IP address can only rate a given joke once. Repeat votes are
            silently ignored — no error, no drama. Just good, clean, democratic groan-scoring.
          </p>
        </section>

        <section className={styles.cta}>
          <h2>Ready to Judge?</h2>
          <p>900+ jokes are waiting for your verdict. One groan at a time.</p>
          <Link href="/" className={styles.ctaButton}>Start Rating Jokes</Link>
        </section>
      </main>
    </div>
  )
}

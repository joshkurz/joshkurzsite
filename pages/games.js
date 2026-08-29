import Head from 'next/head'
import Header from '../components/Header'
import styles from '../styles/Games.module.css'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/best-dad-jokes', label: 'Top Jokes' },
  { href: '/community-jokes', label: 'AI vs Human' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
  { href: '/games', label: 'Games' },
]

const games = [
  {
    slug: 'soccer-brawl',
    icon: '⚽',
    title: 'Soccer Brawl',
    badge: 'Best on Mobile',
    description: "A soccer game my son and I made together — his rules, not mine: no fouls, and you're allowed to punch and kick. Otherwise it plays like a normal match, with score and time keeping and full control of your players up and down the field. Best played on your phone.",
  },
]

export default function Games() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Games - JoshKurz.net</title>
        <meta name="description" content="Games I'm publishing, starting with Soccer Brawl — a soccer game my son and I made together." />
        <link rel="canonical" href="https://joshkurz.net/games" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://joshkurz.net/games" />
        <meta property="og:title" content="Games - JoshKurz.net" />
        <meta property="og:description" content="Games I'm publishing, starting with Soccer Brawl — a soccer game my son and I made together." />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta property="og:image" content="https://joshkurz.net/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://joshkurz.net/og-image.png" />
        <meta name="twitter:title" content="Games - JoshKurz.net" />
        <meta name="twitter:description" content="Games I'm publishing, starting with Soccer Brawl — a soccer game my son and I made together." />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroLabel}>Games</span>
          <h1>Games I&apos;m Publishing</h1>
          <p className={styles.heroSubtitle}>
            A side project shelf for games I make, mostly with my kids.
          </p>
        </section>

        <section className={styles.gameList}>
          {games.map((game) => (
            <a
              key={game.slug}
              href={`/games/${game.slug}`}
              className={styles.gameCard}
            >
              <div className={styles.gameHeader}>
                <span className={styles.gameIcon}>{game.icon}</span>
                <h2 className={styles.gameTitle}>{game.title}</h2>
                <span className={styles.gameBadge}>{game.badge}</span>
              </div>
              <p className={styles.gameDescription}>{game.description}</p>
              <span className={styles.gamePlay}>Play Now</span>
            </a>
          ))}
        </section>
      </main>
    </div>
  )
}

import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import Header from '../../components/Header'
import styles from '../../styles/CategoryPage.module.css'
import { CATEGORIES, CATEGORY_META } from '../../lib/categories'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/top', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

function formatAuthor(author) {
  if (!author) return null
  if (author === 'fatherhood.gov') return 'Fatherhood.gov'
  if (author === 'icanhazdadjoke.com') return 'icanhazdadjoke.com'
  if (author === 'reddit.com/r/dadjokes') return 'r/dadjokes'
  if (author.toLowerCase().startsWith('ai')) return null
  return author
}

export default function CategoryPage({ category, jokes }) {
  const meta = CATEGORY_META[category] || { emoji: '😄', label: `${category} Jokes`, keywords: `${category} dad jokes` }
  const title = `${meta.label} - Dad Jokes`
  const description = `Laugh at the best ${meta.label.toLowerCase()} — ${jokes.length} hand-picked dad jokes about ${category}. Rate your favorites and share the groan-worthy ones.`
  const canonicalUrl = `https://joshkurz.net/jokes/${category}`

  return (
    <div className={styles.container}>
      <Head>
        <title>{title} | JoshKurz.net</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
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
        {jokes.length > 0 && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: title,
            description,
            url: canonicalUrl,
            numberOfItems: jokes.length,
            itemListElement: jokes.slice(0, 10).map((j, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'CreativeWork',
                name: j.opener ? j.opener.slice(0, 100) : `Joke #${i + 1}`,
                description: j.response || j.opener || '',
              },
            })),
          })}} />
        )}
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.heroEmoji}>{meta.emoji}</span>
          <h1>{meta.label}</h1>
          <p className={styles.heroSubtitle}>
            The groan-worthiest dad jokes about {category} — rated by the community.
          </p>
          <span className={styles.jokeCount}>{jokes.length} jokes</span>
        </section>

        {/* Browse other categories */}
        <nav className={styles.categoriesNav} aria-label="Other categories">
          {CATEGORIES.filter(c => c !== category).map(c => (
            <Link key={c} href={`/jokes/${c}`} className={styles.categoryPill}>
              {CATEGORY_META[c]?.emoji} {CATEGORY_META[c]?.label || c}
            </Link>
          ))}
        </nav>

        {jokes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No jokes tagged in this category yet — check back soon!</p>
            <Link href="/" className={styles.ctaButton}>Go Rate Some Jokes</Link>
          </div>
        ) : (
          <div className={styles.jokeList}>
            {jokes.map((joke) => {
              const author = formatAuthor(joke.author)
              return (
                <article key={joke.id} className={styles.jokeCard}>
                  <p className={styles.jokeOpener}>{joke.opener}</p>
                  {joke.response && (
                    <p className={styles.jokeResponse}>{joke.response}</p>
                  )}
                  <div className={styles.jokeMeta}>
                    {author && <span className={styles.authorPill}>{author}</span>}
                    <Link href={`/joke/${joke.id}`} className={styles.shareLink}>
                      Share this joke →
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className={styles.cta}>
          <p>Want to rate these jokes and see which ones the community loves most?</p>
          <Link href="/" className={styles.ctaButton}>Rate Jokes on the Homepage</Link>
        </div>
      </main>
    </div>
  )
}

CategoryPage.propTypes = {
  category: PropTypes.string.isRequired,
  jokes: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    opener: PropTypes.string.isRequired,
    response: PropTypes.string,
    author: PropTypes.string,
  })).isRequired,
}

export function getStaticPaths() {
  return {
    paths: CATEGORIES.map(cat => ({ params: { category: cat } })),
    fallback: false,
  }
}

export async function getStaticProps({ params }) {
  const { category } = params
  if (!CATEGORIES.includes(category)) {
    return { notFound: true }
  }

  // Dynamic import keeps jokesData (fs/crypto) out of the client bundle
  const { getJokesByCategory } = await import('../../lib/jokesData')
  const jokes = getJokesByCategory(category)

  return {
    props: { category, jokes },
    revalidate: 86400, // ISR: rebuild at most once per day
  }
}

import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import styles from '../styles/GuidePage.module.css'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/best-dad-jokes', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

const EXAMPLES = [
  {
    setup: "Why don't scientists trust atoms?",
    punchline: "Because they make up everything!",
    annotation: "Classic wordplay — 'make up' does double duty.",
  },
  {
    setup: "I'm reading a book about anti-gravity.",
    punchline: "It's impossible to put down.",
    annotation: "Everyday phrase reframed in a literal physical context.",
  },
  {
    setup: "What do you call a fish without eyes?",
    punchline: "A fsh.",
    annotation: "Simple, absurd, and the punchline lands immediately.",
  },
  {
    setup: "I told my wife she was drawing her eyebrows too high.",
    punchline: "She looked surprised.",
    annotation: "Setup doubles as the punchline — no extra words needed.",
  },
]

export default function GuidePage() {
  const title = "What Makes a Great Dad Joke? The Complete Guide"
  const description = "Learn the anatomy of a perfect dad joke — setup, punchline, groan factor, and the psychology of why bad puns are so satisfying. With examples and writing tips."

  return (
    <div className={styles.container}>
      <Head>
        <title>{title} | JoshKurz.net</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://joshkurz.net/guide" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://joshkurz.net/guide" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta property="og:image" content="https://joshkurz.net/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://joshkurz.net/og-image.png" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description,
          url: 'https://joshkurz.net/guide',
          publisher: {
            '@type': 'Organization',
            name: 'JoshKurz.net',
            url: 'https://joshkurz.net',
          },
        })}} />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <header className={styles.hero}>
          <h1>What Makes a Great Dad Joke?</h1>
          <p className={styles.heroSubtitle}>
            The anatomy of a perfect groan — setup, punchline, puns, and the psychology behind why
            bad jokes are so weirdly satisfying.
          </p>
        </header>

        <article className={styles.article}>

          <section className={styles.section}>
            <h2>The Anatomy of a Dad Joke</h2>
            <p>
              A dad joke has exactly two parts: a <strong>setup</strong> and a <strong>punchline</strong>.
              The setup plants an expectation — usually a straight question or an innocent-sounding
              statement. The punchline subverts it, almost always through a pun or unexpected
              literal interpretation.
            </p>
            <div className={styles.formulaBox}>
              <p><strong>Setup:</strong> A question or statement that points the listener in one direction.</p>
              <p><strong>Punchline:</strong> A single word or phrase that pivots on a double meaning.</p>
              <p><strong>The groan:</strong> The involuntary sound your audience makes when they realize they were tricked — and that the trick was obvious all along.</p>
            </div>
            <p>
              What separates a great dad joke from a bad one isn&apos;t usually the cleverness of the
              pun — it&apos;s the economy of language. The best dad jokes use the fewest possible words
              to set up and deliver the pivot.
            </p>
          </section>

          <section className={styles.section}>
            <h2>The Groan Factor</h2>
            <p>
              The groan is not a sign of failure. It&apos;s the whole point. A joke that gets a genuine
              laugh is a comedy joke. A joke that gets a groan — especially a reluctant smile — is a
              dad joke. The groan signals that the listener <em>got it</em>, found it predictable in
              retrospect, and is mildly annoyed that it still worked on them.
            </p>
            <p>
              On JoshKurz.net, we measure this with a 1–5 groan scale. A 5-groan joke is one where
              the punchline is so perfectly predicted-yet-surprising that the eye-roll is completely
              involuntary. A 1-groan joke barely qualifies — too obscure, too complex, or the wordplay
              doesn&apos;t quite land.
            </p>
          </section>

          <section className={styles.section}>
            <h2>The Psychology of Puns</h2>
            <p>
              Research in psycholinguistics shows that puns create a specific cognitive effect:
              the brain processes the expected meaning first, then suddenly recognizes the alternative
              meaning. This dual-processing moment — the pivot — is what triggers both the smile and
              the groan simultaneously.
            </p>
            <p>
              Puns also create what researchers call a &ldquo;pleasant violation&rdquo;: something
              that breaks a rule (the rules of expected language) in a harmless way. The harmlessness
              is key. A dad joke doesn&apos;t have a target, doesn&apos;t punch down, and doesn&apos;t
              require dark subject matter. The only victim is the English language itself.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5 Rules for Writing Your Own</h2>
            <ul className={styles.tipsList}>
              <li>
                <strong>Start with the pun, work backwards.</strong> Don&apos;t start with a topic —
                start with a word that has two meanings and build the setup around it. Find the pivot
                first.
              </li>
              <li>
                <strong>Keep the setup to one sentence.</strong> Every extra word is a word that
                might tip off the listener before the punchline. Shorter setups land cleaner.
              </li>
              <li>
                <strong>The punchline should be one phrase.</strong> If you need to explain it, it&apos;s
                not a dad joke — it&apos;s a riddle. The best punchlines are self-evident the instant
                you hear them.
              </li>
              <li>
                <strong>Family-friendly is a feature, not a limitation.</strong> The constraint forces
                creativity. If your joke requires adult content to work, the wordplay isn&apos;t strong
                enough.
              </li>
              <li>
                <strong>Avoid obscure vocabulary.</strong> The punch must land on a word the listener
                already knows. Puns built on unusual words don&apos;t groan — they confuse.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Examples That Work (And Why)</h2>
            <div className={styles.exampleGrid}>
              {EXAMPLES.map((ex) => (
                <div key={ex.setup} className={styles.exampleCard}>
                  <p className={styles.exampleSetup}>{ex.setup}</p>
                  <p className={styles.examplePunchline}>{ex.punchline}</p>
                  <p className={styles.annotation}>{ex.annotation}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2>Where Dad Jokes Come From</h2>
            <p>
              The term &ldquo;dad joke&rdquo; became widespread in the early 2010s, but the format
              is ancient. Q&A puns appear in medieval English literature, Shakespearean wordplay,
              and even ancient Roman humor. What&apos;s modern is the self-aware embrace of the format
              — the knowing groan that acknowledges the joke is terrible <em>and</em> delightful at
              the same time.
            </p>
            <p>
              On JoshKurz.net, jokes come from four sources: Fatherhood.gov&apos;s official collection,
              icanhazdadjoke.com&apos;s community API, the all-time top posts from Reddit&apos;s
              r/dadjokes, and original submissions from visitors like you. The community rates every
              joke, and the top performers surface in the{' '}
              <Link href="/best-dad-jokes" className={styles.link || 'a'} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                Hall of Fame
              </Link>.
            </p>
          </section>

        </article>

        <div className={styles.cta}>
          <p>
            Ready to put your knowledge to use? Submit your own joke to the community, or go rate
            the 900+ dad jokes already in the collection.
          </p>
          <div className={styles.ctaButtons}>
            <Link href="/submit" className={styles.ctaButtonPrimary}>Submit a Joke</Link>
            <Link href="/" className={styles.ctaButtonSecondary}>Rate Jokes</Link>
          </div>
        </div>
      </main>
    </div>
  )
}

import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import styles from '../styles/SubmitPage.module.css'

const navLinks = [
  { href: '/', label: 'Live Jokes' },
  { href: '/top', label: 'Top Jokes' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

export default function SubmitPage() {
  const [setup, setSetup] = useState('')
  const [punchline, setPunchline] = useState('')
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!setup.trim() || !punchline.trim() || !author.trim()) {
      setError('All fields are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/custom-jokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup: setup.trim(), punchline: punchline.trim(), author: author.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to submit your joke.')

      if (data.status === 'accepted') {
        setSuccess('Thanks! Your joke was accepted and is now in the rotation.')
      } else {
        setSuccess(`Thanks for submitting! Our moderator said: ${data.reason}`)
      }
      setSetup('')
      setPunchline('')
      setAuthor('')
    } catch (err) {
      setError(err.message || 'Unable to submit your joke. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Submit a Dad Joke | JoshKurz.net</title>
        <meta name="description" content="Submit your own dad joke to JoshKurz.net. Approved jokes join the rotation and get rated by the community. Share your best groan-worthy humor." />
        <link rel="canonical" href="https://www.joshkurz.net/submit" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.joshkurz.net/submit" />
        <meta property="og:title" content="Submit a Dad Joke | JoshKurz.net" />
        <meta property="og:description" content="Submit your own dad joke. Approved jokes join the rotation and get rated by 900+ jokes worth of community." />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Submit a Dad Joke" />
        <meta name="twitter:description" content="Share your best dad joke with the community. Approved jokes get rated by the crowd." />
      </Head>

      <Header navLinks={navLinks} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Submit Your Dad Joke</h1>
          <p className={styles.heroSubtitle}>
            Think you&apos;ve got a groaner worthy of the community? Submit it below.
            Approved jokes join the main rotation where everyone can rate them.
          </p>
        </section>

        <div className={styles.tips}>
          <h2>Tips for a Great Dad Joke</h2>
          <ul className={styles.tipsList}>
            <li><strong>Keep the setup short</strong> — one sentence is ideal. The less you say before the punchline, the better.</li>
            <li><strong>The pun should be obvious in hindsight</strong> — the groan comes from the wordplay, not from being cryptic.</li>
            <li><strong>Family-friendly</strong> — dad jokes work at the dinner table. Keep it clean.</li>
            <li><strong>One setup, one punchline</strong> — resist the urge to explain it.</li>
          </ul>
        </div>

        <div className={styles.formCard}>
          <h2>Your Joke</h2>
          {success ? (
            <p className={styles.success}>{success}</p>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="setup">Setup</label>
                <textarea
                  id="setup"
                  className={styles.textarea}
                  value={setup}
                  onChange={e => setSetup(e.target.value)}
                  placeholder="e.g., Why don't scientists trust atoms?"
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="punchline">Punchline</label>
                <textarea
                  id="punchline"
                  className={styles.textarea}
                  value={punchline}
                  onChange={e => setPunchline(e.target.value)}
                  placeholder="e.g., Because they make up everything!"
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="author">Your Name</label>
                <input
                  id="author"
                  type="text"
                  className={styles.input}
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder="e.g., Dad Master 3000"
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.submitButton} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Joke'}
              </button>
            </form>
          )}
        </div>

        <div className={styles.cta}>
          <p>
            Want to read the guide first?{' '}
            <Link href="/guide" className={styles.link}>What Makes a Great Dad Joke?</Link>
          </p>
          <p>
            Or browse the <Link href="/top" className={styles.link}>community hall of fame</Link> for inspiration.
          </p>
        </div>
      </main>
    </div>
  )
}

import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import styles from '../styles/JokeRater.module.css'

const DEFAULT_STATS = { counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, average: 0, totalRatings: 0 }

function normalizeStats(data = {}) {
  return {
    counts: { ...DEFAULT_STATS.counts, ...(data.counts || {}) },
    average: Number(data.average || 0),
    totalRatings: Number(data.totalRatings || 0),
  }
}

export default function JokeRater({ jokeId, jokeText, jokeAuthor }) {
  const [stats, setStats] = useState(DEFAULT_STATS)
  const [userRating, setUserRating] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!jokeId) return
    fetch(`/api/ratings?jokeId=${encodeURIComponent(jokeId)}`)
      .then(r => r.json())
      .then(data => setStats(normalizeStats(data)))
      .catch(() => {})
  }, [jokeId])

  async function handleRate(value) {
    if (submitting || submitted) return
    setUserRating(value)
    setHovered(null)
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jokeId,
          rating: value,
          joke: jokeText,
          author: jokeAuthor || undefined,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to save rating')
      }
      const data = await res.json()
      setStats(normalizeStats(data))
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Unable to save rating. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const displayRating = hovered || userRating || 0
  const canInteract = !submitting && !submitted

  return (
    <div className={styles.rater}>
      <p className={styles.prompt}>How many groans does this joke deserve?</p>

      <div
        className={styles.buttonGroup}
        onMouseLeave={canInteract ? () => setHovered(null) : undefined}
      >
        {[1, 2, 3, 4, 5].map(value => {
          const isActive = value <= displayRating
          const isSelected = submitted && userRating && value <= userRating
          return (
            <button
              key={value}
              type="button"
              className={[
                styles.groanBtn,
                isActive ? styles.groanBtnActive : '',
                isSelected ? styles.groanBtnSelected : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleRate(value)}
              disabled={submitting || submitted}
              aria-label={`${value} groan${value === 1 ? '' : 's'}`}
              aria-pressed={userRating === value}
              onMouseEnter={canInteract ? () => setHovered(value) : undefined}
              onFocus={canInteract ? () => setHovered(value) : undefined}
              onBlur={canInteract ? (e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setHovered(null)
              } : undefined}
            >
              <span className={styles.srOnly}>{value} groan{value === 1 ? '' : 's'}</span>
              <span
                aria-hidden="true"
                className={`${styles.emoji} ${isActive ? styles.emojiActive : ''}`}
              >
                🤦‍♂️
              </span>
            </button>
          )
        })}
      </div>

      <div className={styles.summary}>
        {submitted ? (
          <>
            {stats.totalRatings > 0 ? (
              <p>
                Average: <strong>{stats.average}</strong> groans &middot; {stats.totalRatings} total rating{stats.totalRatings === 1 ? '' : 's'}
              </p>
            ) : (
              <p>Be the first to rate this groaner.</p>
            )}
            <p className={styles.thanks}>Thanks for the vote!</p>
          </>
        ) : (
          <p>Cast your vote to reveal the crowd rating.</p>
        )}
        {error && <p className={styles.errorMsg}>{error}</p>}
      </div>
    </div>
  )
}

JokeRater.propTypes = {
  jokeId: PropTypes.string.isRequired,
  jokeText: PropTypes.string.isRequired,
  jokeAuthor: PropTypes.string,
}

JokeRater.defaultProps = {
  jokeAuthor: undefined,
}

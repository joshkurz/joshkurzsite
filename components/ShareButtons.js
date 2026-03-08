import { useState } from 'react'
import PropTypes from 'prop-types'
import styles from '../styles/ShareButtons.module.css'

export default function ShareButtons({ jokeId, jokeText, shareUrl }) {
  const [copied, setCopied] = useState(false)

  async function trackShare(platform) {
    try {
      await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jokeId, platform }),
      })
    } catch {
      // non-critical — don't block the user action
    }
  }

  function handleX() {
    trackShare('x')
    const text = encodeURIComponent(`${jokeText} #dadjokes`)
    const url = encodeURIComponent(shareUrl)
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  function handleFacebook() {
    trackShare('facebook')
    const url = encodeURIComponent(shareUrl)
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  async function handleCopy() {
    trackShare('copy')
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text manually not needed for this use case
    }
  }

  return (
    <div className={styles.shareButtons}>
      <span className={styles.label}>Share this joke:</span>
      <div className={styles.buttons}>
        <button className={styles.btn} onClick={handleX}>
          𝕏 Post
        </button>
        <button className={styles.btn} onClick={handleFacebook}>
          Facebook
        </button>
        <button
          className={`${styles.btn} ${copied ? styles.copied : ''}`}
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  )
}

ShareButtons.propTypes = {
  jokeId: PropTypes.string.isRequired,
  jokeText: PropTypes.string.isRequired,
  shareUrl: PropTypes.string.isRequired,
}

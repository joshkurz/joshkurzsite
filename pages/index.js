import Head from 'next/head'
import Link from 'next/link'
import React from 'react'
import styles from '../styles/Home.module.css'
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import JokeSpeaker from '../components/JokeSpeaker'
import { parseStream } from '../lib/parseJokeStream'
import {
  getAiJokeNickname,
  parseAiAuthorSignature,
  resolveNicknameFromMetadata
} from '../lib/aiJokeNicknames'

const defaultRatingStats = {
  counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  average: 0,
  totalRatings: 0
}

function normalizeStats(stats = {}) {
  return {
    counts: { ...defaultRatingStats.counts, ...(stats.counts || {}) },
    average: Number(stats.average || 0),
    totalRatings: Number(stats.totalRatings || 0)
  }
}

function nextStreakMilestone(count) {
  const milestones = [5, 10, 25, 50, 100];
  for (const m of milestones) {
    if (count < m) return { milestone: m, remaining: m - count };
  }
  return null;
}

function resolveDisplayAuthor(author, metadata) {
  const normalizedAuthor = typeof author === 'string' ? author.trim() : ''
  const nickname = resolveNicknameFromMetadata(metadata)
  if (nickname) {
    return nickname
  }
  const signature = parseAiAuthorSignature(normalizedAuthor)
  if (signature) {
    return getAiJokeNickname(signature.model, signature.promptVersion)
  }
  return normalizedAuthor || 'Unknown'
}


class OpenAIData extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      isLoaded: false,
      isComplete: false,
      question: "",
      answer: "",
      questionTokens: [],
      answerTokens: [],
      pendingQuestion: '',
      ratingStats: { ...defaultRatingStats },
      userRating: null,
      hoveredRating: null,
      isSubmittingRating: false,
      ratingError: null,
      hasSubmittedRating: false,
      currentJokeId: null,
      currentJokeText: '',
      currentJokeSpeechText: '',
      currentJokeAuthor: '',
      currentJokeDisplayAuthor: '',
      currentJokeMetadata: null,
      loadedJokeId: null,
      isSubmitFormOpen: false,
      submitSetup: '',
      submitPunchline: '',
      submitAuthor: '',
      isSubmittingJoke: false,
      submitError: null,
      submitMessage: '',
      streakCount: 0,
      jokesExhausted: false,
      exhaustedMessage: null,
      globalVotes: null
    };
  }

  componentDidMount() {
    this.fetchJoke();
    this.fetchGlobalStats();
    try {
      const stored = sessionStorage.getItem('jokeStreak');
      if (stored) {
        const { count } = JSON.parse(stored);
        this.setState({ streakCount: count || 0 });
      }
    } catch {
      // sessionStorage unavailable or invalid JSON — ignore
    }
  }

  fetchGlobalStats = async () => {
    try {
      const response = await fetch('/api/global-stats');
      if (!response.ok) return;
      const data = await response.json();
      if (data.totalRatings > 0) {
        this.setState({ globalVotes: data.totalRatings });
      }
    } catch {
      // Non-critical — ignore
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.isComplete &&
      (prevState.questionTokens !== this.state.questionTokens ||
        prevState.answerTokens !== this.state.answerTokens ||
        prevState.isComplete !== this.state.isComplete)
    ) {
      this.prepareJokeMetadata();
    }
  }

  prepareJokeMetadata = () => {
    const { questionTokens, answerTokens, currentJokeId, loadedJokeId } = this.state;
    const question = questionTokens.join(' ').trim();
    const answer = answerTokens.join(' ').trim();
    if (!question && !answer) {
      return;
    }
    const parts = [];
    if (question) parts.push(question);
    if (answer) parts.push(answer);
    const jokeText = parts.join(' || ').trim();
    const speechText = parts
      .join('. ')
      .replace(/\s+/g, ' ')
      .trim();
    const jokeId = loadedJokeId || this.createJokeId(jokeText);
    if (jokeId === currentJokeId) {
      return;
    }
    this.setState({
      currentJokeId: jokeId,
      currentJokeText: jokeText,
      currentJokeSpeechText: speechText || jokeText,
      ratingStats: { ...defaultRatingStats },
      userRating: null,
      hoveredRating: null,
      isSubmittingRating: false,
      ratingError: null,
      hasSubmittedRating: false,
      loadedJokeId: loadedJokeId || null
    });
  }
  createJokeId = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return `joke-${Math.abs(hash)}`;
  }

  handleGroanClick = async (value) => {
    const {
      currentJokeId,
      currentJokeText,
      currentJokeAuthor,
      hasSubmittedRating,
      isSubmittingRating
    } = this.state;
    if (!currentJokeId || hasSubmittedRating || isSubmittingRating) {
      return;
    }
    this.setState({
      userRating: value,
      hoveredRating: null,
      isSubmittingRating: true,
      ratingError: null
    });
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jokeId: currentJokeId,
          rating: value,
          joke: currentJokeText,
          author: currentJokeAuthor || undefined
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to save rating');
      }
      const data = await response.json();
      this.setState(prev => ({
        ratingStats: normalizeStats(data),
        hasSubmittedRating: true,
        ratingError: null,
        globalVotes: prev.globalVotes !== null ? prev.globalVotes + 1 : null
      }));
      this.incrementStreak(currentJokeId);
    } catch (error) {
      this.setState({ ratingError: error });
    } finally {
      this.setState({ isSubmittingRating: false });
    }
  }

  incrementStreak = (jokeId) => {
    try {
      const stored = sessionStorage.getItem('jokeStreak');
      const streak = stored ? JSON.parse(stored) : { count: 0, ratedIds: [] };
      if (streak.ratedIds.includes(jokeId)) {
        return;
      }
      streak.ratedIds.push(jokeId);
      streak.count = streak.ratedIds.length;
      sessionStorage.setItem('jokeStreak', JSON.stringify(streak));
      this.setState({ streakCount: streak.count });
    } catch {
      // sessionStorage unavailable — ignore
    }
  }

  handleGroanHover = (value) => {
    const { hasSubmittedRating, isSubmittingRating } = this.state;
    if (hasSubmittedRating || isSubmittingRating) {
      return;
    }
    this.setState({ hoveredRating: value });
  };

  clearGroanHover = () => {
    const { hasSubmittedRating, isSubmittingRating } = this.state;
    if (hasSubmittedRating || isSubmittingRating) {
      return;
    }
    this.setState({ hoveredRating: null });
  };

  toggleSubmitForm = () => {
    this.setState((prev) => ({
      isSubmitFormOpen: !prev.isSubmitFormOpen,
      submitMessage: '',
      submitError: null
    }));
  };

  handleSubmitFieldChange = (event) => {
    const { name, value } = event.target;
    if (!['submitSetup', 'submitPunchline', 'submitAuthor'].includes(name)) {
      return;
    }
    this.setState({ [name]: value });
  };

  handleSubmitJoke = async (event) => {
    event.preventDefault();
    const { submitSetup, submitPunchline, submitAuthor } = this.state;
    const payload = {
      setup: submitSetup.trim(),
      punchline: submitPunchline.trim(),
      author: submitAuthor.trim()
    };
    if (!payload.setup || !payload.punchline || !payload.author) {
      this.setState({ submitError: 'All fields are required.' });
      return;
    }
    this.setState({ isSubmittingJoke: true, submitError: null, submitMessage: '' });
    try {
      const response = await fetch('/api/custom-jokes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to share your joke.');
      }
      if (data.status === 'accepted') {
        this.setState({
          submitMessage: 'Thanks for sharing! Your joke was accepted.',
          submitSetup: '',
          submitPunchline: '',
          submitAuthor: ''
        });
      } else {
        this.setState({
          submitMessage: `Thanks for submitting! Our moderator said: ${data.reason}`
        });
      }
    } catch (err) {
      this.setState({
        submitError: err.message || 'Unable to share your joke. Please try again.'
      });
    } finally {
      this.setState({ isSubmittingJoke: false });
    }
  };

  loadJokeFromEndpoint = async (endpoint, { method = 'GET', body } = {}) => {
    this.setState({
      error: null,
      isLoaded: false,
      isComplete: false,
      question: '',
      answer: '',
      questionTokens: [],
      answerTokens: [],
      pendingQuestion: '',
      ratingStats: { ...defaultRatingStats },
      userRating: null,
      hoveredRating: null,
      isSubmittingRating: false,
      ratingError: null,
      hasSubmittedRating: false,
      currentJokeId: null,
      currentJokeText: '',
      currentJokeSpeechText: '',
      currentJokeAuthor: '',
      currentJokeDisplayAuthor: '',
      currentJokeMetadata: null,
      loadedJokeId: null,
      jokesExhausted: false,
      exhaustedMessage: null
    });

    try {
      const fetchOptions = { method };
      if (method && method.toUpperCase() !== 'GET') {
        fetchOptions.headers = { 'Content-Type': 'application/json' };
        fetchOptions.body = body !== undefined ? JSON.stringify(body) : '{}';
      }

      const res = await fetch(endpoint, fetchOptions);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to load a dad joke');
      }
      const data = await res.json();
      if (data.exhausted) {
        this.setState({
          isLoaded: true,
          isComplete: true,
          jokesExhausted: true,
          exhaustedMessage: data.message || "You've rated every joke in our collection! Thanks for your contribution!"
        });
        return;
      }
      const initialState = {
        question: '',
        answer: '',
        questionTokens: [],
        answerTokens: [],
        pendingQuestion: ''
      };
      const parsed = parseStream(data.text || '', initialState);
      const storedAuthor = data.author || 'Unknown';
      const metadata = data.metadata || null;
      const displayAuthor = resolveDisplayAuthor(storedAuthor, metadata);
      this.setState(
        {
          ...parsed,
          isLoaded: true,
          isComplete: true,
          error: null,
          loadedJokeId: data.id || null,
          currentJokeAuthor: storedAuthor,
          currentJokeDisplayAuthor: displayAuthor,
          currentJokeMetadata: metadata
        },
        () => {
          this.prepareJokeMetadata();
        }
      );
    } catch (error) {
      this.setState({
        error,
        isLoaded: true,
        isComplete: true
      });
    }
  }

  fetchJoke = () => {
    this.loadJokeFromEndpoint('/api/random-joke');
  }

  fetchAiJoke = () => {
    this.loadJokeFromEndpoint('/api/ai-joke', { method: 'POST' });
  }

  render() {
    const {
      error,
      isLoaded,
      isComplete,
      question,
      questionTokens,
      answer,
      answerTokens,
      ratingStats,
      userRating,
      hoveredRating,
      isSubmittingRating,
      ratingError,
      hasSubmittedRating,
      currentJokeAuthor,
      currentJokeDisplayAuthor,
      currentJokeSpeechText,
      loadedJokeId,
      isSubmitFormOpen,
      submitSetup,
      submitPunchline,
      submitAuthor,
      isSubmittingJoke,
      submitError,
      submitMessage,
      streakCount,
      jokesExhausted,
      exhaustedMessage,
      globalVotes
    } = this.state;

    const displayQuestionTokens =
      questionTokens.length > 0
        ? questionTokens
        : question
          ? [question]
          : [];

    const displayAnswerTokens =
      answerTokens.length > 0 ? answerTokens : answer ? [answer] : [];
    const canInteract = !isSubmittingRating && !hasSubmittedRating;
    const displayRating = hoveredRating || userRating || 0;
    const isPreviewing = hoveredRating !== null;

    if (error) {
      return <div>Error Loading: {error.message}</div>;
    }
    if (!isLoaded) {
      return (
        <div className={styles.jokeContainer}>
          <div className={styles.jokeHeaderRow}>
            <h2 className={styles.jokeHeader}>Fresh Groaners</h2>
          </div>
          <Spinner />
        </div>
      );
    }
    if (jokesExhausted) {
      return (
        <div className={styles.jokeContainer}>
          <h2 className={styles.jokeHeader}>Fresh Groaners</h2>
          <p className={styles.question}>{exhaustedMessage}</p>
          <div className={styles.jokeActions}>
            <button className={styles.newJokeButton} type="button" onClick={this.fetchJoke}>
              New Joke
            </button>
            <button
              className={`${styles.newJokeButton} ${styles.aiJokeButton}`}
              type="button"
              onClick={this.fetchAiJoke}
            >
              Feeling Groany?
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.jokeContainer}>
        <div className={styles.jokeHeaderRow}>
          <h2 className={styles.jokeHeader}>Fresh Groaners</h2>
          {globalVotes !== null && (
            <span className={styles.globalVotesStat} aria-live="polite">
              🗳️ {globalVotes.toLocaleString()} groans cast
            </span>
          )}
        </div>
        {displayQuestionTokens.length > 0 && (
          <p className={styles.question}>
            {displayQuestionTokens.map((t, i) => (
              <span key={i} className={styles.fadeIn}>{t}</span>
            ))}
          </p>
        )}
        {displayAnswerTokens.length > 0 && (
          <p className={styles.answer}>
            {displayAnswerTokens.map((t, i) => (
              <span key={i} className={styles.fadeIn}>{t}</span>
            ))}
          </p>
        )}
        {currentJokeDisplayAuthor && (
          <p className={styles.authorTag}>
            <span className={styles.authorLabel}>Author:</span> {currentJokeDisplayAuthor}
          </p>
        )}
        {streakCount > 0 && streakCount % 3 === 0 && (
          <div className={styles.streakBadge} role="status" aria-live="polite">
            🔥 {streakCount} jokes rated in a row!
          </div>
        )}
        {isComplete && (
          <>
            <div className={styles.ratingSection}>
              <p className={styles.ratingPrompt}>How many groans does this joke deserve?</p>
              <div
                className={styles.groanButtonGroup}
                onMouseLeave={canInteract ? this.clearGroanHover : undefined}
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const isActive = value <= displayRating;
                  const isSelected = !isPreviewing && userRating ? value <= userRating : false;
                  const buttonClass = [
                    styles.groanButton,
                    isActive ? styles.groanButtonActive : '',
                    isSelected ? styles.groanButtonSelected : ''
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      key={value}
                      type="button"
                      className={buttonClass}
                      onClick={() => this.handleGroanClick(value)}
                      disabled={isSubmittingRating || hasSubmittedRating}
                      aria-label={`${value} groan${value === 1 ? '' : 's'}`}
                      onMouseEnter={
                        canInteract ? () => this.handleGroanHover(value) : undefined
                      }
                      onFocus={canInteract ? () => this.handleGroanHover(value) : undefined}
                      onBlur={
                        canInteract
                          ? (event) => {
                              if (
                                event.relatedTarget &&
                                event.currentTarget.parentElement?.contains(event.relatedTarget)
                              ) {
                                return;
                              }
                              this.clearGroanHover();
                            }
                          : undefined
                      }
                      aria-pressed={userRating === value}
                    >
                      <span className={styles.srOnly}>{`${value} groan${value === 1 ? '' : 's'}`}</span>
                      <span
                        aria-hidden="true"
                        className={`${styles.groanEmoji} ${isActive ? styles.groanEmojiActive : ''}`}
                      >
                        🤦‍♂️
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.ratingSummary}>
                {hasSubmittedRating ? (
                  ratingStats.totalRatings > 0 ? (
                    <p>
                      Average rating: <strong>{ratingStats.average}</strong> groans ·{' '}
                      {ratingStats.totalRatings} total rating
                      {ratingStats.totalRatings === 1 ? '' : 's'}
                    </p>
                  ) : (
                    <p>Be the first to rate this groaner.</p>
                  )
                ) : (
                  <p>Cast your vote to reveal the crowd rating.</p>
                )}
                {hasSubmittedRating && (
                  <>
                    <p className={styles.ratingThanks}>Thanks for letting us know how much you groaned!</p>
                    {(() => {
                      const next = nextStreakMilestone(streakCount);
                      if (!next) return null;
                      return (
                        <p className={styles.streakNudge}>
                          ⚡ {next.remaining} more {next.remaining === 1 ? 'groan' : 'groans'} to hit your {next.milestone}-vote streak!
                        </p>
                      );
                    })()}
                  </>
                )}
                {ratingError && (
                  <p className={styles.ratingError}>We couldn&apos;t save your rating. Please try again.</p>
                )}
              </div>
            </div>
          </>
        )}
        {isComplete && currentJokeSpeechText && (
          <div className={styles.speakSection}>
            <JokeSpeaker
              text={currentJokeSpeechText}
              buttonLabel="🔊 Hear this joke"
            />
          </div>
        )}
        {isComplete && (
          <div className={styles.jokeActions}>
            <button className={styles.newJokeButton} type="button" onClick={this.fetchJoke}>
              New Joke
            </button>
            <button
              className={`${styles.newJokeButton} ${styles.aiJokeButton}`}
              type="button"
              onClick={this.fetchAiJoke}
            >
              Feeling Groany?
            </button>
            {loadedJokeId && (
              <Link href={`/joke/${loadedJokeId}`} className={styles.shareButton}>
                🔗 Share This Joke
              </Link>
            )}
          </div>
        )}
        <div className={styles.submitSection}>
          <div className={styles.submitCallToAction}>
            <h3 className={styles.submitHeading}>Got a Dad Joke?</h3>
            <p className={styles.submitDescription}>
              Submit your own joke and let the community rate it! Your joke will be added to the rotation for everyone to enjoy.
            </p>
          </div>
          <button className={styles.submitToggleButton} onClick={this.toggleSubmitForm}>
            {isSubmitFormOpen ? 'Cancel' : 'Submit Your Joke'}
          </button>
          {isSubmitFormOpen && (
            <form className={styles.shareForm} onSubmit={this.handleSubmitJoke}>
              <label className={styles.shareLabel}>
                <span>Setup</span>
                <textarea
                  name="submitSetup"
                  className={styles.shareInput}
                  value={submitSetup}
                  onChange={this.handleSubmitFieldChange}
                  rows={3}
                  placeholder="e.g., Why don't scientists trust atoms?"
                />
              </label>
              <label className={styles.shareLabel}>
                <span>Punchline</span>
                <textarea
                  name="submitPunchline"
                  className={styles.shareInput}
                  value={submitPunchline}
                  onChange={this.handleSubmitFieldChange}
                  rows={3}
                  placeholder="e.g., Because they make up everything!"
                />
              </label>
              <label className={styles.shareLabel}>
                <span>Your Name</span>
                <input
                  type="text"
                  name="submitAuthor"
                  className={styles.shareInput}
                  value={submitAuthor}
                  onChange={this.handleSubmitFieldChange}
                  placeholder="e.g., Dad Master 3000"
                />
              </label>
              {submitError && <p className={styles.shareError}>{submitError}</p>}
              {submitMessage && <p className={styles.shareMessage}>{submitMessage}</p>}
              <button className={styles.submitButton} type="submit" disabled={isSubmittingJoke}>
                {isSubmittingJoke ? 'Submitting...' : 'Submit Joke'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }
}

export default function Home() {
  const [featuredJoke, setFeaturedJoke] = React.useState(null);
  const [featuredLoading, setFeaturedLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/featured-joke')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.opener) setFeaturedJoke(data);
        setFeaturedLoading(false);
      })
      .catch(() => { setFeaturedLoading(false); });
  }, []);

  const navLinks = [
    { href: '/', label: 'Live Jokes' },
    { href: '/top', label: 'Top Jokes' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/about', label: 'About' },
  ];
  return (
    <div className={styles.container}>
      <Head>
        <title>Dad Jokes - Vote, Rate & Hear Funny Dad Jokes</title>
        <meta name="description" content="Vote on 900+ dad jokes, rate your favorites on a groan scale, submit your own, and listen via text-to-speech. AI-generated jokes too." />
        <link rel="canonical" href="https://joshkurz.net/" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://joshkurz.net/" />
        <meta property="og:title" content="Dad Jokes - Vote, Rate & Hear Funny Dad Jokes" />
        <meta property="og:description" content="Vote on 900+ dad jokes, rate your favorites on a groan scale, submit your own, and listen via text-to-speech. AI-generated jokes too." />
        <meta property="og:site_name" content="JoshKurz.net Dad Jokes" />
        <meta property="og:image" content="https://joshkurz.net/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://joshkurz.net/og-image.png" />
        <meta name="twitter:title" content="Dad Jokes - Vote, Rate & Hear Funny Dad Jokes" />
        <meta name="twitter:description" content="Vote on 900+ dad jokes, rate your favorites on a groan scale, submit your own, and listen via text-to-speech." />

        {/* WebSite schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Dad Jokes - JoshKurz.net",
          "url": "https://joshkurz.net",
          "description": "Interactive dad jokes platform — vote, rate, submit, and listen to dad jokes with AI generation and community rankings.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://joshkurz.net/dashboard",
            "query-input": "required"
          }
        })}} />

        {/* FAQ schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is this dad jokes website?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "JoshKurz.net is an interactive dad jokes platform where you can vote and rate over 900 dad jokes on a groan-worthy scale, submit your own jokes, listen to them via text-to-speech, and even generate new ones using AI."
              }
            },
            {
              "@type": "Question",
              "name": "How do I vote on dad jokes?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Each joke shows a rating scale from 1 to 5. Just click your rating after reading the joke — 1 being barely a groan and 5 being a legendary dad joke. Your vote is saved and contributes to the community rankings."
              }
            },
            {
              "@type": "Question",
              "name": "Can I submit my own dad joke?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes! Click the submit button on the homepage to add your joke. Community votes determine which jokes rise to the top of the rankings."
              }
            },
            {
              "@type": "Question",
              "name": "How does the AI dad joke generator work?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Click the AI Joke button and our AI model generates a brand-new, original dad joke in real time. The AI is inspired by the highest-rated jokes in our community collection."
              }
            },
            {
              "@type": "Question",
              "name": "Can I listen to dad jokes out loud?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes — every joke has a text-to-speech button so you can hear it read aloud. Perfect for sharing at the dinner table without looking at your phone."
              }
            }
          ]
        })}} />
      </Head>
      <Header navLinks={navLinks} />

      {/* Static hero — always in initial HTML, fully indexed by Google */}
      <section className={styles.homeHero}>
        <h1 className={styles.homeHeroTitle}>Vote on Dad Jokes</h1>
        <p className={styles.homeHeroSubtitle}>
          900+ dad jokes from four sources. Rate each one on a groan scale,
          submit your own, or let AI generate a fresh one on the spot.
        </p>
        <div className={styles.sourcePills}>
          <Link href="/author/fatherhood.gov" className={styles.sourcePill}>fatherhood.gov</Link>
          <Link href="/author/icanhazdadjoke.com" className={styles.sourcePill}>icanhazdadjoke.com</Link>
          <Link href={`/author/${encodeURIComponent('reddit.com/r/dadjokes')}`} className={styles.sourcePill}>r/dadjokes</Link>
          <Link href="/submit" className={styles.sourcePill}>Community</Link>
        </div>
      </section>

      {(featuredLoading || featuredJoke) && (
        <section className={styles.featuredJokeSection}>
          {featuredLoading ? (
            <div className={`${styles.featuredJokeCard} ${styles.featuredJokeSkeleton}`}>
              <span className={styles.featuredBadge}>⭐ Top Community Groaner</span>
              <div className={styles.skeletonLine} style={{ width: '80%', height: '1.2em', marginBottom: '0.5rem' }} />
              <div className={styles.skeletonLine} style={{ width: '60%', height: '1em' }} />
            </div>
          ) : (
            <div className={styles.featuredJokeCard}>
              <span className={styles.featuredBadge}>⭐ Top Community Groaner</span>
              <p className={styles.featuredQuestion}>{featuredJoke.opener}</p>
              {featuredJoke.punchline && (
                <p className={styles.featuredAnswer}>{featuredJoke.punchline}</p>
              )}
              <div className={styles.featuredMeta}>
                {featuredJoke.author && (
                  <span className={styles.featuredAuthor}>{featuredJoke.author}</span>
                )}
                <span className={styles.featuredStats}>
                  ⭐ {featuredJoke.average} avg · {featuredJoke.totalRatings} votes
                </span>
                {featuredJoke.jokeId && (
                  <Link href={`/joke/${featuredJoke.jokeId}`} className={styles.featuredLink}>
                    Rate it →
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <main className={styles.main}>
        <OpenAIData />
      </main>

      {/* Static content below the fold — indexed by Google */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepIcon}>🎲</div>
            <h3>Get a Random Joke</h3>
            <p>A dad joke is served from our collection of 900+ jokes — sourced from government archives, community APIs, and Reddit&apos;s top all-time posts.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepIcon}>🤦‍♂️</div>
            <h3>Rate the Groan Factor</h3>
            <p>Give it 1–5 groans. One reluctant chuckle or a full eye-roll? Your vote is saved and contributes to the community leaderboard on the <Link href="/top" className={styles.inlineLink}>Top Jokes</Link> page.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepIcon}>🤖</div>
            <h3>Generate with AI</h3>
            <p>Hit &ldquo;Feeling Groany?&rdquo; and an AI model generates a brand-new dad joke in real time — inspired by the highest-rated jokes in our collection.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepIcon}>✍️</div>
            <h3>Submit Your Own</h3>
            <p>Think you&apos;ve got a groaner worthy of the hall of fame? Submit it. Approved jokes enter the main rotation and get voted on by the community.</p>
          </div>
        </div>
      </section>

      <section className={styles.categorySection}>
        <h2 className={styles.sectionTitle}>Browse Jokes by Category</h2>
        <div className={styles.categoryGrid}>
          {[
            { slug: 'animals',    emoji: '🐾', label: 'Animal Jokes' },
            { slug: 'food',       emoji: '🍕', label: 'Food Jokes' },
            { slug: 'science',    emoji: '🔬', label: 'Science Jokes' },
            { slug: 'technology', emoji: '💻', label: 'Tech Jokes' },
            { slug: 'sports',     emoji: '⚽', label: 'Sports Jokes' },
            { slug: 'work',       emoji: '💼', label: 'Work Jokes' },
            { slug: 'school',     emoji: '📚', label: 'School Jokes' },
            { slug: 'weather',    emoji: '⛅', label: 'Weather Jokes' },
          ].map(({ slug, emoji, label }) => (
            <Link key={slug} href={`/jokes/${slug}`} className={styles.categoryCard}>
              <span className={styles.categoryEmoji}>{emoji}</span>
              <span className={styles.categoryLabel}>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.faqSection}>
        <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
        <dl className={styles.faqList}>
          <div className={styles.faqItem}>
            <dt>What is this dad jokes website?</dt>
            <dd>JoshKurz.net is an interactive dad jokes platform where you can vote and rate over 900 dad jokes on a groan-worthy scale, submit your own jokes, listen to them via text-to-speech, and generate new ones using AI.</dd>
          </div>
          <div className={styles.faqItem}>
            <dt>How do I vote on dad jokes?</dt>
            <dd>Each joke shows a rating scale from 1 to 5 groans. Click your rating after reading the joke — 1 being barely a groan and 5 being a legendary dad joke. Your vote is saved and contributes to the community rankings.</dd>
          </div>
          <div className={styles.faqItem}>
            <dt>Can I submit my own dad joke?</dt>
            <dd>Yes! Click &ldquo;Submit Your Joke&rdquo; below any joke to add yours. Community votes determine which jokes rise to the top of the <Link href="/top" className={styles.inlineLink}>leaderboard</Link>.</dd>
          </div>
          <div className={styles.faqItem}>
            <dt>How does the AI dad joke generator work?</dt>
            <dd>Click the &ldquo;Feeling Groany?&rdquo; button and our AI model generates a brand-new, original dad joke in real time. The AI is inspired by the highest-rated jokes in our community collection.</dd>
          </div>
          <div className={styles.faqItem}>
            <dt>Can I listen to dad jokes out loud?</dt>
            <dd>Yes — every joke has a text-to-speech button so you can hear it read aloud. Perfect for sharing at the dinner table without looking at your phone. You can also use the dedicated <Link href="/speak" className={styles.inlineLink}>Listen page</Link>.</dd>
          </div>
          <div className={styles.faqItem}>
            <dt>Where do the jokes come from?</dt>
            <dd>Jokes are sourced from fatherhood.gov, icanhazdadjoke.com, the top all-time posts on Reddit&apos;s r/dadjokes community, and jokes submitted by visitors to this site. All sources are rotated fairly.</dd>
          </div>
        </dl>
      </section>

    </div>
  )
}

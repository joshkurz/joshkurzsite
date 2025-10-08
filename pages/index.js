import Head from 'next/head'
import React from 'react'
import styles from '../styles/Home.module.css'
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import { parseStream } from '../lib/parseJokeStream'

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
      isSubmittingRating: false,
      ratingError: null,
      hasSubmittedRating: false,
      currentJokeId: null,
      currentJokeText: '',
      jokeMode: 'live',
      dailyContext: null
    };
    this.eventSource = null;
  }

  componentDidMount() {
    const defaultMode =
      typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_DEFAULT_JOKE_MODE === 'daily'
        ? 'daily'
        : 'live';
    let savedMode = null;
    try {
      savedMode = window.localStorage.getItem('jokeMode');
    } catch (error) {
      savedMode = null;
    }
    const mode = savedMode === 'daily' ? 'daily' : defaultMode;
    this.setState({ jokeMode: mode }, () => {
      this.loadJokeForMode(mode);
    });
  }

  componentWillUnmount() {
    if (this.eventSource) {
      this.eventSource.close();
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
    const { questionTokens, answerTokens, currentJokeId } = this.state;
    const question = questionTokens.join(' ').trim();
    const answer = answerTokens.join(' ').trim();
    if (!question && !answer) {
      return;
    }
    const parts = [];
    if (question) parts.push(question);
    if (answer) parts.push(answer);
    const jokeText = parts.join(' || ').trim();
    const jokeId = this.createJokeId(jokeText);
    if (jokeId === currentJokeId) {
      return;
    }
    this.setState(
      {
        currentJokeId: jokeId,
        currentJokeText: jokeText,
        ratingStats: { ...defaultRatingStats },
        userRating: null,
        isSubmittingRating: false,
        ratingError: null,
        hasSubmittedRating: false
      },
      () => {
        this.fetchRatingStats(jokeId);
      }
    );
  }

  loadJokeForMode = (mode) => {
    if (mode === 'daily') {
      this.fetchDailyJoke();
      return;
    }
    this.fetchJoke();
  }

  createJokeId = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return `joke-${Math.abs(hash)}`;
  }

  fetchRatingStats = async (jokeId) => {
    const { jokeMode } = this.state
    try {
      const params = new URLSearchParams({ jokeId, mode: jokeMode })
      const response = await fetch(`/api/ratings?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Unable to load ratings');
      }
      const data = await response.json();
      this.setState({ ratingStats: normalizeStats(data), ratingError: null });
    } catch (error) {
      this.setState({ ratingError: error, ratingStats: { ...defaultRatingStats } });
    }
  }

  handleGroanClick = async (value) => {
    const {
      currentJokeId,
      currentJokeText,
      hasSubmittedRating,
      isSubmittingRating,
      jokeMode,
      dailyContext
    } = this.state;
    if (!currentJokeId || hasSubmittedRating || isSubmittingRating) {
      return;
    }
    this.setState({ userRating: value, isSubmittingRating: true, ratingError: null });
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jokeId: currentJokeId,
          rating: value,
          joke: jokeMode === 'live' ? currentJokeText : undefined,
          mode: jokeMode,
          date: jokeMode === 'daily' && dailyContext?.date ? dailyContext.date : undefined
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to save rating');
      }
      const data = await response.json();
      this.setState({
        ratingStats: normalizeStats(data),
        hasSubmittedRating: true,
        ratingError: null
      });
    } catch (error) {
      this.setState({ ratingError: error });
    } finally {
      this.setState({ isSubmittingRating: false });
    }
  }

  fetchJoke = () => {
    // Close any existing connection before opening a new one
    if (this.eventSource) {
      this.eventSource.close();
    }
    // Reset state so the spinner is shown while loading
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
      isSubmittingRating: false,
      ratingError: null,
      hasSubmittedRating: false,
      currentJokeId: null,
      currentJokeText: '',
      dailyContext: null
    });

    // Establish an EventSource connection to receive SSEs from the backend
    this.eventSource = new EventSource("/api/openai");
    // Buffer for the raw streamed joke so we can incrementally parse the
    // question and answer as tokens arrive.
    let rawJoke = "";
    let hasStartedStreaming = false;
    const timeoutId = setTimeout(() => {
      if (!hasStartedStreaming) {
        this.eventSource.close();
        this.loadFallbackJoke();
      }
    }, 3000);
    this.eventSource.onmessage = (event) => {
      const data = event.data;
      if (data === "[DONE]") {
        clearTimeout(timeoutId);
        this.setState({ isComplete: true });
        this.eventSource.close();
        return;
      }
      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        clearTimeout(timeoutId);
      }
      rawJoke += data;
      this.setState(prevState => ({
        ...parseStream(rawJoke, prevState),
        isLoaded: true
      }));
    };

    this.eventSource.onerror = () => {
      clearTimeout(timeoutId);
      this.eventSource.close();
      this.loadFallbackJoke();
    };
  }

  fetchDailyJoke = async () => {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
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
      isSubmittingRating: false,
      ratingError: null,
      hasSubmittedRating: false,
      currentJokeId: null,
      currentJokeText: '',
      dailyContext: null
    });
    try {
      const res = await fetch('/api/daily-joke');
      if (!res.ok) {
        throw new Error('Unable to load the daily joke');
      }
      const data = await res.json();
      const initialState = {
        question: '',
        answer: '',
        questionTokens: [],
        answerTokens: [],
        pendingQuestion: ''
      };
      const parsed = parseStream(data.joke || '', initialState);
      this.setState(
        {
          ...parsed,
          isLoaded: true,
          isComplete: true,
          error: null,
          dailyContext: data.context || null
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

  loadFallbackJoke = async () => {
    try {
      const res = await fetch('/api/random-joke');
      const data = await res.json();
      const initialState = {
        question: '',
        answer: '',
        questionTokens: [],
        answerTokens: [],
        pendingQuestion: ''
      };
      const parsed = parseStream(data.joke, initialState);
      this.setState({
        ...parsed,
        isLoaded: true,
        isComplete: true,
        error: null
      });
    } catch (error) {
      this.setState({
        isLoaded: true,
        isComplete: true,
        error
      });
    }
  }

  handleModeChange = (mode) => {
    if (mode === this.state.jokeMode) {
      return;
    }
    try {
      window.localStorage.setItem('jokeMode', mode);
    } catch (error) {
      // Ignore storage failures
    }
    this.setState({ jokeMode: mode }, () => {
      this.loadJokeForMode(mode);
    });
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
      isSubmittingRating,
      ratingError,
      hasSubmittedRating,
      jokeMode,
      dailyContext
    } = this.state;

    const displayQuestionTokens =
      questionTokens.length > 0
        ? questionTokens
        : question
          ? [question]
          : [];

    const displayAnswerTokens =
      answerTokens.length > 0 ? answerTokens : answer ? [answer] : [];
    if (error) {
      return <div>Error Loading: {error.message}</div>;
    }
    if (!isLoaded) {
      return <Spinner />;
    }
    return (
      <div className={styles.jokeContainer}>
        {/* Update the header to be a bit more playful */}
        <h2 className={styles.jokeHeader}>Dad Joke of the Day (Guaranteed to Make You Groan)</h2>
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeButton} ${jokeMode === 'live' ? styles.modeButtonActive : ''}`}
            onClick={() => this.handleModeChange('live')}
          >
            Live Stream
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${jokeMode === 'daily' ? styles.modeButtonActive : ''}`}
            onClick={() => this.handleModeChange('daily')}
          >
            Joke of the Day
          </button>
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
        {isComplete && (
          <>
            <div className={styles.ratingSection}>
              <p className={styles.ratingPrompt}>How many groans does this joke deserve?</p>
              <div className={styles.groanButtonGroup}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const isActive = userRating ? value <= userRating : false;
                  const buttonClass = `${styles.groanButton} ${isActive ? styles.groanButtonActive : ''}`;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={buttonClass}
                      onClick={() => this.handleGroanClick(value)}
                      disabled={isSubmittingRating || hasSubmittedRating}
                      aria-label={`${value} groan${value === 1 ? '' : 's'}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <div className={styles.ratingSummary}>
                {ratingStats.totalRatings > 0 ? (
                  <p>
                    Average rating: <strong>{ratingStats.average}</strong> groans ·{' '}
                    {ratingStats.totalRatings} total rating{ratingStats.totalRatings === 1 ? '' : 's'}
                  </p>
                ) : (
                  <p>Be the first to rate this groaner.</p>
                )}
                {hasSubmittedRating && (
                  <p className={styles.ratingThanks}>Thanks for letting us know how much you groaned!</p>
                )}
                {ratingError && (
                  <p className={styles.ratingError}>We couldn&apos;t save your rating. Please try again.</p>
                )}
              </div>
            </div>
          </>
        )}
        {isComplete && (
          <button
            className={styles.newJokeButton}
            onClick={jokeMode === 'daily' ? this.fetchDailyJoke : this.fetchJoke}
          >
            {jokeMode === 'daily' ? 'Reload Daily Joke' : 'New Joke'}
          </button>
        )}
        {jokeMode === 'daily' && dailyContext && (
          <div className={styles.dailyContext}>
            <h3>Why this topic and this joke today?</h3>
            <p className={styles.dailyBlurb}>{dailyContext.selectionNotes}</p>
            <p className={styles.dailyBlurb}>{dailyContext.sourceDescription}</p>
            {dailyContext.year ? (
              <p>
                In {dailyContext.year}, {dailyContext.text}
              </p>
            ) : (
              <p>{dailyContext.text}</p>
            )}
            {dailyContext.summary && (
              <p className={styles.dailySummary}>{dailyContext.summary}</p>
            )}
            {dailyContext.reason && (
              <p className={styles.dailyReason}>
                <strong>Why it made the cut:</strong> {dailyContext.reason}
              </p>
            )}
            {dailyContext.angle && (
              <p className={styles.dailyReason}>
                <strong>Comedic angle:</strong> {dailyContext.angle}
              </p>
            )}
            {dailyContext.topicOrigin && (
              <p className={styles.dailyBlurb}>{dailyContext.topicOrigin}</p>
            )}
            {dailyContext.source && (
              <a
                className={styles.dailyLink}
                href={dailyContext.source}
                target="_blank"
                rel="noreferrer"
              >
                Read more about today&apos;s event
              </a>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default function Home() {
  const navLinks = [
    { href: '/', label: 'Live Jokes' },
    { href: '/speak', label: 'Speak' },
    { href: '/dashboard', label: 'Dashboard' }
  ];
  return (
    <div className={styles.container}>
      <Head>
        <title>Josh Kurz | Dad Jokes</title>
        <meta name="description" content="Random Dad Jokes From GPT Models" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header navLinks={navLinks} />

      <main className={styles.main}>
        {/* Render the joke UI outside of an h1 for better semantics */}
        <OpenAIData />
      </main>

    </div>
  )
}

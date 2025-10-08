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
      currentDateKey: new Date().toISOString().slice(0, 10),
      jokeMode: 'live',
      dailyContext: null
    };
    this.eventSource = null;
  }

  componentDidMount() {
    const envDefault =
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEFAULT_JOKE_MODE : null;
    const defaultMode = envDefault === 'live' ? 'live' : 'daily';
    let savedMode = null;
    try {
      savedMode = window.localStorage.getItem('jokeMode');
    } catch (error) {
      savedMode = null;
    }
    const mode = savedMode === 'live' || savedMode === 'daily' ? savedMode : defaultMode;
    this.setState({ jokeMode: mode, currentDateKey: this.getDateKey() }, () => {
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

  getDateKey = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  };

  prepareJokeMetadata = () => {
    const {
      questionTokens,
      answerTokens,
      currentJokeId,
      currentJokeText,
      jokeMode,
      dailyContext,
      currentDateKey
    } = this.state;
    const question = questionTokens.join(' ').trim();
    const answer = answerTokens.join(' ').trim();
    if (!question && !answer) {
      return;
    }
    const parts = [];
    if (question) parts.push(question);
    if (answer) parts.push(answer);
    const jokeText = parts.join(' || ').trim();
    const dateKey =
      (jokeMode === 'daily' ? dailyContext?.date : currentDateKey) || this.getDateKey();

    let jokeId = currentJokeId;
    let shouldFetchStats = false;

    if (jokeMode === 'daily') {
      const desiredId = `daily-${dateKey}`;
      if (desiredId !== jokeId) {
        jokeId = desiredId;
        shouldFetchStats = true;
      }
    } else if (!jokeId || !jokeId.startsWith('live-')) {
      jokeId = this.createLiveJokeId(dateKey);
      shouldFetchStats = true;
    }

    if (jokeId === currentJokeId && jokeText === currentJokeText) {
      return;
    }

    this.setState(
      (prevState) => ({
        currentJokeId: jokeId,
        currentJokeText: jokeText,
        ratingStats: shouldFetchStats ? { ...defaultRatingStats } : prevState.ratingStats,
        userRating: shouldFetchStats ? null : prevState.userRating,
        isSubmittingRating: false,
        ratingError: shouldFetchStats ? null : prevState.ratingError,
        hasSubmittedRating: shouldFetchStats ? false : prevState.hasSubmittedRating,
        currentDateKey: dateKey
      }),
      () => {
        if (shouldFetchStats || jokeId !== currentJokeId) {
          this.fetchRatingStats(jokeId, dateKey);
        }
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

  createLiveJokeId = (dateKey) => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `live-${dateKey}-${crypto.randomUUID()}`;
    }
    return `live-${dateKey}-${Math.random().toString(36).slice(2, 10)}`;
  }

  fetchRatingStats = async (jokeId, dateKey) => {
    try {
      const params = new URLSearchParams({ jokeId });
      if (dateKey) {
        params.set('date', dateKey);
      }
      const response = await fetch(`/api/ratings?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Unable to load ratings');
      }
      const data = await response.json();
      this.setState({
        ratingStats: normalizeStats(data),
        ratingError: null,
        currentDateKey: data?.date || dateKey || this.getDateKey()
      });
    } catch (error) {
      this.setState({
        ratingError: error,
        ratingStats: { ...defaultRatingStats }
      });
    }
  }

  handleGroanClick = async (value) => {
    const {
      currentJokeId,
      currentJokeText,
      hasSubmittedRating,
      isSubmittingRating,
      currentDateKey
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
          joke: currentJokeText,
          date: currentDateKey
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
        ratingError: null,
        currentDateKey: data?.date || currentDateKey
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
      currentDateKey: this.getDateKey(),
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
      currentDateKey: this.getDateKey(),
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
          dailyContext: data.context || null,
          currentDateKey: data?.context?.date || this.getDateKey()
        },
        () => {
          this.prepareJokeMetadata();
        }
      );
    } catch (error) {
      this.setState({
        error,
        isLoaded: true,
        isComplete: true,
        currentDateKey: this.getDateKey()
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
        error: null,
        currentDateKey: this.getDateKey()
      });
    } catch (error) {
      this.setState({
        isLoaded: true,
        isComplete: true,
        error,
        currentDateKey: this.getDateKey()
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
    this.setState({ jokeMode: mode, currentDateKey: this.getDateKey() }, () => {
      this.loadJokeForMode(mode);
    });
  }

  render() {
    const {
      error,
      isLoaded,
      isComplete,
      questionTokens,
      answerTokens,
      ratingStats,
      userRating,
      isSubmittingRating,
      ratingError,
      hasSubmittedRating,
      jokeMode,
      dailyContext
    } = this.state;
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
        {questionTokens.length > 0 && (
          <p className={styles.question}>
            {questionTokens.map((t, i) => (
              <span key={i} className={styles.fadeIn}>{t}</span>
            ))}
          </p>
        )}
        {answerTokens.length > 0 && (
          <p className={styles.answer}>
            {answerTokens.map((t, i) => (
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
            <h3>Why today?</h3>
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
    { href: '/', label: 'Home' },
    { href: '/speak', label: 'Speak' }
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

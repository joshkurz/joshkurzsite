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
      hoveredRating: null,
      isSubmittingRating: false,
      ratingError: null,
      hasSubmittedRating: false,
      currentJokeId: null,
      currentJokeText: '',
      loadedJokeId: null
    };
  }

  componentDidMount() {
    this.fetchJoke();
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
    const jokeId = loadedJokeId || this.createJokeId(jokeText);
    if (jokeId === currentJokeId) {
      return;
    }
    this.setState(
      {
        currentJokeId: jokeId,
        currentJokeText: jokeText,
        ratingStats: { ...defaultRatingStats },
        userRating: null,
        hoveredRating: null,
        isSubmittingRating: false,
        ratingError: null,
        hasSubmittedRating: false,
        loadedJokeId: loadedJokeId || null
      },
      () => {
        this.fetchRatingStats(jokeId);
      }
    );
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
    try {
      const params = new URLSearchParams({ jokeId })
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
    const { currentJokeId, currentJokeText, hasSubmittedRating, isSubmittingRating } = this.state;
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
          joke: currentJokeText
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

  fetchJoke = async () => {
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
      loadedJokeId: null
    });

    try {
      const res = await fetch('/api/random-joke');
      if (!res.ok) {
        throw new Error('Unable to load a dad joke');
      }
      const data = await res.json();
      const initialState = {
        question: '',
        answer: '',
        questionTokens: [],
        answerTokens: [],
        pendingQuestion: ''
      };
      const parsed = parseStream(data.text || '', initialState);
      this.setState(
        {
          ...parsed,
          isLoaded: true,
          isComplete: true,
          error: null,
          loadedJokeId: data.id || null
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
      hasSubmittedRating
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
      return <Spinner />;
    }
    return (
      <div className={styles.jokeContainer}>
        <h2 className={styles.jokeHeader}>Fresh Groaners from Fatherhood.gov</h2>
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
          <button className={styles.newJokeButton} onClick={this.fetchJoke}>
            New Joke
          </button>
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

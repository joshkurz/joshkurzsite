import Head from 'next/head'
import React from 'react'
import styles from '../styles/Home.module.css'
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import { parseStream } from '../lib/parseJokeStream'


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
      pendingQuestion: ''
    };
    this.eventSource = null;
  }

  componentDidMount() {
    // Load the initial joke when the component mounts
    this.fetchJoke();
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
      pendingQuestion: ''
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

  componentWillUnmount() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }

  render() {
    const { error, isLoaded, isComplete, questionTokens, answerTokens } = this.state;
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

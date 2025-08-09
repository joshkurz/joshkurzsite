import Head from 'next/head'
import React from 'react'
import styles from '../styles/Home.module.css'
import Header from '../components/Header'
import Spinner from '../components/Spinner'


class OpenAIData extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      isLoaded: false,
      question: "",
      answer: "",
      questionTokens: [],
      answerTokens: []
    };
    this.eventSource = null;
  }

  componentDidMount() {
    // Establish an EventSource connection to receive SSEs from the backend
    this.eventSource = new EventSource("/api/openai");
    // Buffer for the raw streamed joke so we can incrementally parse the
    // question and answer as tokens arrive.
    let rawJoke = "";
    let questionText = "";
    let answerText = "";

    this.eventSource.onmessage = (event) => {
      const data = event.data;
      if (data === "[DONE]") {
        // Close the connection when the server signals completion
        this.eventSource.close();
        return;
      }
      // Append the incoming chunk and attempt to parse the question/answer
      rawJoke += data;
      const lower = rawJoke.toLowerCase();
      const qLabel = "question:";
      const aLabel = "answer:";
      const qIndex = lower.indexOf(qLabel);
      const aIndex = lower.indexOf(aLabel);
      const prevQuestion = questionText;
      const prevAnswer = answerText;
      if (qIndex !== -1) {
        if (aIndex !== -1 && aIndex > qIndex) {
          questionText = rawJoke
            .slice(qIndex + qLabel.length, aIndex)
            .replace(/^\s*/, '');
          answerText = rawJoke
            .slice(aIndex + aLabel.length)
            .replace(/^\s*/, '');
        } else {
          questionText = rawJoke
            .slice(qIndex + qLabel.length)
            .replace(/^\s*/, '');
        }
      }
      const questionDelta = questionText.slice(prevQuestion.length);
      const answerDelta = answerText.slice(prevAnswer.length);
      this.setState(prevState => ({
        isLoaded: true,
        question: questionText,
        answer: answerText,
        questionTokens: questionDelta ? [...prevState.questionTokens, questionDelta] : prevState.questionTokens,
        answerTokens: answerDelta ? [...prevState.answerTokens, answerDelta] : prevState.answerTokens,
      }));
    };

    this.eventSource.onerror = (error) => {
      // Record any error and close the SSE connection
      this.setState({
        isLoaded: true,
        error
      });
      this.eventSource.close();
    };
  }

  componentWillUnmount() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }

  render() {
    const { error, isLoaded, questionTokens, answerTokens } = this.state;
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

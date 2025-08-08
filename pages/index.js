import Head from 'next/head'
import React from 'react'
import styles from '../styles/Home.module.css'
import Spinner from '../components/Spinner'


class OpenAIData extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      isLoaded: false,
      question: "",
      answer: ""
    };
    this.eventSource = null;
  }

  componentDidMount() {
    // Establish an EventSource connection to receive SSEs from the backend
    this.eventSource = new EventSource("/api/openai");
    // Buffer for the raw streamed joke. We'll assemble the full text here and
    // split it into question and answer once the stream is complete.
    let rawJoke = "";

    this.eventSource.onmessage = (event) => {
      // Mark that we've started receiving events
      this.setState({ isLoaded: true });
      const data = event.data;
      if (data === "[DONE]") {
        // Close the connection when the server signals completion
        this.eventSource.close();
        // Once streaming is complete, parse the accumulated joke text.
        // We expect the joke text to contain "Question:" and "Answer:" labels, but
        // the exact line breaks or spacing may vary. Use indexOf to locate the
        // labels and slice out the question and answer accordingly.
        let questionText = "";
        let answerText = "";
        const lower = rawJoke.toLowerCase();
        const qLabel = "question:";
        const aLabel = "answer:";
        const qIndex = lower.indexOf(qLabel);
        const aIndex = lower.indexOf(aLabel);
        if (qIndex !== -1 && aIndex !== -1 && aIndex > qIndex) {
          questionText = rawJoke.slice(qIndex + qLabel.length, aIndex).trim();
          answerText = rawJoke.slice(aIndex + aLabel.length).trim();
        } else {
          // Fallback: attempt splitting on newlines and taking first and second lines
          const parts = rawJoke.split(/\r?\n/);
          questionText = parts[0] ? parts[0].replace(/^[Qq]uestion:\s*/, '').trim() : '';
          answerText = parts[1] ? parts[1].replace(/^[Aa]nswer:\s*/, '').trim() : '';
        }
        this.setState({ question: questionText, answer: answerText });
        return;
      }
      // If not done, append the chunk to our raw joke buffer
      rawJoke += data;
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
    const { error, isLoaded, question, answer } = this.state;
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
        {question && (
          <p key={question} className={`${styles.question} ${styles.fadeIn}`}>{question}</p>
        )}
        {answer && (
          <p key={answer} className={`${styles.answer} ${styles.fadeIn}`}>{answer}</p>
        )}
      </div>
    );
  }
}

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Josh Kurz | Dad Jokes</title>
        <meta name="description" content="Random Dad Jokes From GPT Models" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {/* Render the joke UI outside of an h1 for better semantics */}
        <OpenAIData />
      </main>

    </div>
  )
}

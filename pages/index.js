import Head from 'next/head'
import React from 'react'
import styles from '../styles/Home.module.css'


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
    // We accumulate the answer as it streams in
    let answerSoFar = "";

    this.eventSource.onmessage = (event) => {
      // Mark that we've started receiving events
      this.setState({ isLoaded: true });
      const data = event.data;
      if (data === "[DONE]") {
        // Close the connection when the server signals completion
        this.eventSource.close();
        return;
      }
      try {
        // Try to parse the event data as JSON to determine its type
        const payload = JSON.parse(data);
        if (payload.type === 'question') {
          // Set the question text from the payload
          this.setState({ question: payload.text });
        } else if (payload.type === 'answer') {
          // Append incoming answer fragments to build the full answer
          answerSoFar += payload.text;
          this.setState({ answer: answerSoFar });
        }
      } catch (e) {
        // Fallback for non‑JSON payloads: treat the data as part of the answer
        answerSoFar += data;
        this.setState({ answer: answerSoFar });
      }
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
      return <div>Loading...</div>;
    }
    return (
      <div className={styles.jokeContainer}>
        {/* Update the header to be a bit more playful */}
        <h2 className={styles.jokeHeader}>Dad Joke of the Day (Guaranteed to Make You Groan)</h2>
        {question && (
          <p className={styles.question}><strong>Question:</strong> {question}</p>
        )}
        {answer && (
          <p className={styles.answer}><strong>Answer:</strong> {answer}</p>
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

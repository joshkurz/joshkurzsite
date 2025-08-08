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
        // We expect the joke text to contain lines starting with "Question:" and "Answer:".
        const lines = rawJoke.split(/\r?\n/).map(l => l.trim());
        let questionText = "";
        let answerText = "";
        lines.forEach((line) => {
          if (line.toLowerCase().startsWith("question:")) {
            questionText = line.substring("Question:".length).trim();
          } else if (line.toLowerCase().startsWith("answer:")) {
            answerText = line.substring("Answer:".length).trim();
          }
        });
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
      return <div>Loading...</div>;
    }
    return (
      <div className={styles.jokeContainer}>
        {/* Update the header to be a bit more playful */}
        <h2 className={styles.jokeHeader}>Dad Joke of the Day (Guaranteed to Make You Groan)</h2>
        {question && (
          <p className={styles.question}>{question}</p>
        )}
        {answer && (
          <p className={styles.answer}>{answer}</p>
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

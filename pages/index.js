import Head from 'next/head'
import Image from 'next/image'
import React from 'react'
import styles from '../styles/Home.module.css'
import Typewriter from "typewriter-effect";  


class OpenAIData extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      isLoaded: false,
      text: ""
    };
    this.eventSource = null;
  }

  componentDidMount() {
    this.eventSource = new EventSource("/api/openai");
    let joke = "";

    this.eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        this.setState({ isLoaded: true });
        this.eventSource.close();
      } else {
        joke += event.data;
        this.setState({ text: joke });
      }
    };

    this.eventSource.onerror = (error) => {
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
    const { error, isLoaded, text } = this.state;
    if (error) {
      return <div>Error Loading: {error.message}</div>;
    } else if (!isLoaded) {
      return <div>Loading...</div>;
    } else {
      return (
        <h4>
          {text}
        </h4>
      );
    }
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
        <h1 className={styles.title}>
          Want to Hear a Dad Joke?
        </h1>
        
        <div className={styles.grid}>
            <OpenAIData></OpenAIData>
        </div>
      </main>

    </div>
  )
}

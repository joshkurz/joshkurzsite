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
      items: []
    };
  }

  componentDidMount() {
    fetch("/api/openai")
      .then(res => res.json())
      .then(
        (result) => {
          console.log(result)
          this.setState({
            isLoaded: true,
            text: result.data
          });
        },
        // Note: it's important to handle errors here
        // instead of a catch() block so that we don't swallow
        // exceptions from actual bugs in components.
        (error) => {
          this.setState({
            isLoaded: true,
            error
          });
        }
      )
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
          <Typewriter
                onInit={(typewriter)=> {
                typewriter
                .pauseFor(1000)
                .changeDelay(50)
                .typeString(text)
                .start();
                }}
                />
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
        <Typewriter
          onInit={(typewriter)=> {
          typewriter
          .changeDelay(50)
          .typeString("Want to Hear a Dad Joke?")
          .start();
          }}
        />
        </h1>
        
        <div className={styles.grid}>
            <OpenAIData></OpenAIData>
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://opensesamelocksmith.com"
          target="_blank"
          rel="noopener noreferrer"
        >
        Powered by Open Sesame Locksmith
        </a>
      </footer>
    </div>
  )
}

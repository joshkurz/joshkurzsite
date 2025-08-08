import Head from 'next/head'
import ReactAudioPlayer from 'react-audio-player';
import { useState } from 'react';
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import styles from '../styles/Home.module.css'

export default function SpeechHelper() {

  const [inputValue, setInputValue] = useState('');
  const [source, setSourceValue] = useState('');
  const [isLoading, setIsLoadingValue] = useState(false);
  const [isLoaded, setIsLoadedValue] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' }
  ];

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const sendDataToBackend = async () => {
    setIsLoadingValue(true);
    setIsLoadedValue(true);
    setSourceValue(`/api/speak?text=${encodeURIComponent(inputValue)}`);
  };

  const handleCanPlay = () => {
    setIsLoadingValue(false);
  };

  // clear inputValue text
  const clearText = () => {
    setInputValue('');
    setSourceValue('');
    setIsLoadedValue(false);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Josh Kurz | Speech Helper</title>
        <meta name="description" content="Help do text to speech" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header navLinks={navLinks} />
      <main className={styles.main}>
        <input
          className={styles.textbox}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter What you want to say."
        />
        <div className={styles.buttonGroup}>
          <button className={styles.formbutton} onClick={clearText}>Clear</button>
          <button className={styles.formbutton} onClick={sendDataToBackend}>Create</button>
        </div>
        {isLoaded && (
          <ReactAudioPlayer
            src={source}
            controls
            onCanPlay={handleCanPlay}
          />
        )}
        {isLoading && <Spinner />}
      </main>
    </div>
  );
}
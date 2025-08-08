import Head from 'next/head'
import ReactAudioPlayer from 'react-audio-player';
import { useState } from 'react';
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import styles from '../styles/Speak.module.css'

export default function SpeechHelper() {

  const [inputValue, setInputValue] = useState('');
  const [source, setSourceValue] = useState('');
  const [isLoading, setIsLoadingValue] = useState(false);
  const [isLoaded, setIsLoadedValue] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/speak', label: 'Speak' }
  ];

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const sendDataToBackend = async () => {
    try {
      setIsLoadedValue(false);
      setIsLoadingValue(true);
      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputValue }),
      });

      if (response.ok) {
        setSourceValue("/api/serve?" + new Date().getTime());
        console.log('Data sent successfully!');
        setIsLoadedValue(true);
        // Additional logic if needed after sending data
      } else {
        console.error('Failed to send data.');
      }
    } catch (error) {
      console.error('Error sending data:', error);
    }
    setIsLoadingValue(false);
  };

  // clear inputValue text
  const clearText = () => {
    setInputValue('');
    setIsLoadedValue(false);
  }

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
          placeholder="Enter what you want to say."
        />
        <div className={styles.buttonGroup}>
          <button className={styles.formbutton} onClick={clearText}>Clear</button>
          <button className={styles.formbutton} onClick={sendDataToBackend}>Create</button>
        </div>
        {isLoaded && (
          <ReactAudioPlayer
            className={styles.audioPlayer}
            src={source}
            controls
          />
        )}
        {isLoading && <Spinner />}
      </main>
    </div>
  );
}
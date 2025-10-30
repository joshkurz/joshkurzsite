import Head from 'next/head'
import ReactAudioPlayer from 'react-audio-player';
import { useState, useEffect } from 'react';
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import styles from '../styles/Speak.module.css'

export default function SpeechHelper() {

  const [inputValue, setInputValue] = useState('');
  const [source, setSourceValue] = useState('');
  const [isLoading, setIsLoadingValue] = useState(false);
  const [isLoaded, setIsLoadedValue] = useState(false);
  const [voice, setVoice] = useState('coral');

  const navLinks = [
    { href: '/', label: 'Live Jokes' },
    { href: '/speak', label: 'Speak' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/blog', label: 'Blog' }
  ];

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleVoiceChange = (event) => {
    const newVoice = event.target.value;
    setVoice(newVoice);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('voice', newVoice);
      if (inputValue) {
        url.searchParams.set('text', inputValue);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const sendDataToBackend = async () => {
    setIsLoadingValue(true);
    setIsLoadedValue(true);
    setSourceValue(`/api/speak?text=${encodeURIComponent(inputValue)}&voice=${encodeURIComponent(voice)}`);
    // If not demo script, update URL
    if (!inputValue.startsWith('Hello there! This is a comprehensive test for the text-to-audio bot.')) {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('text', inputValue);
        url.searchParams.set('voice', voice);
        window.history.replaceState({}, '', url.toString());
      }
    }
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

  // load a random dad joke from the local dataset
  const loadRandomJoke = async () => {
    const res = await fetch('/api/random-joke');
    const data = await res.json();
    const question = (data.opener || '').replace(/^Question:\s*/i, '').trim();
    const answer = (data.response || '').replace(/^Answer:\s*/i, '').trim();
    const combined = answer ? `${question}          ${answer}` : question;
    setInputValue(combined);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const textParam = urlParams.get('text');
      const voiceParam = urlParams.get('voice');
      if (textParam) {
        setInputValue(textParam);
      }
      if (voiceParam) {
        setVoice(voiceParam);
      }
    }
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Josh Kurz | Speech Helper</title>
        <meta name="description" content="Help do text to speech" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header navLinks={navLinks} />
      <main className={styles.main}>
        <div className={styles.inputWrapper}>
          <input
            className={styles.textbox}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter what you want to say."
          />
          {inputValue && (
            <button className={styles.iconButton} onClick={clearText} title="Clear">✕</button>
          )}
        </div>
        <div className={styles.dropdownWrapper}>
          <label htmlFor="voice-select" className={styles.dropdownLabel}>Voice:</label>
          <select
            id="voice-select"
            className={styles.dropdown}
            value={voice}
            onChange={handleVoiceChange}
          >
            <option value="alloy">Alloy</option>
            <option value="ash">Ash</option>
            <option value="ballad">Ballad</option>
            <option value="coral">Coral</option>
            <option value="echo">Echo</option>
            <option value="fable">Fable</option>
            <option value="nova">Nova</option>
            <option value="onyx">Onyx</option>
            <option value="sage">Sage</option>
            <option value="shimmer">Shimmer</option>
          </select>
        </div>
        <div className={styles.buttonGroup}>
          <button className={styles.formbutton} onClick={sendDataToBackend}>Play</button>
          <button className={styles.formbutton} onClick={loadRandomJoke}>Load Random Dad Joke</button>
        </div>
        {isLoaded && (
          <ReactAudioPlayer
            className={styles.audioPlayer}
            src={source}
            controls
            autoPlay
            onCanPlay={handleCanPlay}
          />
        )}
        {isLoading && <Spinner />}
      </main>
    </div>
  );
}

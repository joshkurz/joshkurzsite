import Head from 'next/head'
import ReactAudioPlayer from 'react-audio-player'; 
import { useState } from 'react';
import styles from '../styles/Home.module.css'

export default function SpeechHelper() {

  const [inputValue, setInputValue] = useState('');
  const [source, setSourceValue] = useState('');

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const sendDataToBackend = async () => {
    try {
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
        // Additional logic if needed after sending data
      } else {
        console.error('Failed to send data.');
      }
    } catch (error) {
      console.error('Error sending data:', error);
    }
  };

  return <div className={styles.container}>
      <Head>
        <title>Josh Kurz | Speech Helper</title>
        <meta name="description" content="Help do text to speech" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
      <input
        className={styles.textbox}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Enter data"
      />
      <button className={styles.textbox} onClick={sendDataToBackend}>Create</button>
      
      <ReactAudioPlayer
        src={source}
        controls
      />
      </main>
  </div>
}
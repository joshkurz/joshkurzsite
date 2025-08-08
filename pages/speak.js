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

  // load demo script
  const loadDemoScript = () => {
    setInputValue(`Hello there! This is a comprehensive test for the text-to-audio bot.
We’re going to explore a wide range of speech patterns, sentence lengths, and tricky phrases to see how well you handle them.

First, let’s start simple:
The quick brown fox jumps over the lazy dog.
A classic pangram containing every letter of the English alphabet.

Now, a short tongue twister:
She sells seashells by the seashore. The shells she sells are surely seashells.

Alright—time for a shift in tone. Imagine you’re narrating an audiobook:

“Under the pale silver moon, the ship’s sails billowed like ghostly wings, carrying the travelers toward an uncertain horizon. Each creak of the wooden boards whispered secrets of the deep.”

Let’s try some numbers and dates:

Today is Thursday, August 7th, 2025.

My phone number is five five five, one two three, four five six seven.

The total comes to $1,247.38 — including tax.

Pi is approximately 3.14159.

How about abbreviations and acronyms?
NASA launched the Artemis II mission in 2024.
I work in the R&D department at a company that uses AI, NLP, and IoT technologies.

Now, testing emphasis and pauses:
Wait… what did you just say?
No. Absolutely not.
Yes—well, maybe.
I suppose… we could try it.

A dramatic change in speed:
Slowly, deliberately, he turned the key.
Then—BANG!—the door flew open and the sound of rushing wind filled the room.

Here’s a paragraph with mixed sentence structures:
Sometimes, life moves at a steady pace. Other times, everything happens at once—emails, phone calls, deadlines, alarms. In those moments, clarity comes from a single breath. Inhale. Exhale. Focus. And then… keep going.

For testing long continuous reading:
“In the heart of the bustling city, where neon lights painted the night sky and the air hummed with the rhythm of countless footsteps, there lived a musician who played not for fame, nor for fortune, but for the fleeting moments when a stranger’s eyes would light up at the sound of his melody. His guitar was worn, its strings replaced countless times, yet each note carried the weight of his journey—stories of loss, hope, and the quiet beauty of persistence.”

Finally, ending with a multilingual test:
Bonjour, comment ça va? (French)
Hola, me llamo Javier. (Spanish)
Guten Tag, wie geht’s Ihnen? (German)
こんにちは、元気ですか？ (Japanese)

And that concludes the test script for the text-to-audio bot.
If you’ve made it this far without a glitch—congratulations!`);
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
        <div className={styles.buttonGroup}>
          <button className={styles.formbutton} onClick={sendDataToBackend}>Play</button>
          <button className={styles.formbutton} onClick={loadDemoScript}>Load Demo Script</button>
        </div>
        {isLoaded && (
          <ReactAudioPlayer
            className={styles.audioPlayer}
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
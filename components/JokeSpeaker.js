import { useState, useEffect, useMemo } from 'react';
import ReactAudioPlayer from 'react-audio-player';
import styles from '../styles/JokeSpeaker.module.css';

const DEFAULT_VOICE = 'coral';

export default function JokeSpeaker({
  text,
  voice = DEFAULT_VOICE,
  buttonLabel = '🔊 Hear this joke',
  buttonClassName = ''
}) {
  const [source, setSource] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasRequestedAudio, setHasRequestedAudio] = useState(false);
  const [error, setError] = useState('');

  const sanitizedText = useMemo(() => (text || '').trim(), [text]);
  const sanitizedVoice = useMemo(() => (voice || DEFAULT_VOICE).trim() || DEFAULT_VOICE, [voice]);

  useEffect(() => {
    setSource('');
    setIsLoading(false);
    setHasRequestedAudio(false);
    setError('');
  }, [sanitizedText, sanitizedVoice]);

  const handleSpeak = () => {
    if (!sanitizedText) {
      return;
    }
    setError('');
    setIsLoading(true);
    setHasRequestedAudio(true);
    setSource(`/api/speak?text=${encodeURIComponent(sanitizedText)}&voice=${encodeURIComponent(sanitizedVoice)}`);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handleAudioError = () => {
    setIsLoading(false);
    setError('Unable to play audio right now. Please try again.');
  };

  const buttonClasses = [styles.speakButton, buttonClassName].filter(Boolean).join(' ');

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={buttonClasses}
        onClick={handleSpeak}
        disabled={!sanitizedText || isLoading}
      >
        {buttonLabel}
      </button>
      {isLoading && (
        <div className={styles.loadingIndicator} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.loadingText}>Preparing audio…</span>
        </div>
      )}
      {error && <p className={styles.errorMessage}>{error}</p>}
      {hasRequestedAudio && source && (
        <ReactAudioPlayer
          src={source}
          autoPlay
          controls
          onCanPlay={handleCanPlay}
          onError={handleAudioError}
          className={styles.audioPlayer}
        />
      )}
    </div>
  );
}

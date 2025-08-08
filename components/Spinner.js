import styles from '../styles/Spinner.module.css';

export default function Spinner() {
  return (
    <div className={styles.spinnerContainer} role="status" aria-label="Loading">
      <svg className={styles.spinner} viewBox="0 0 50 50">
        <circle
          className={styles.path}
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="5"
        />
      </svg>
    </div>
  );
}

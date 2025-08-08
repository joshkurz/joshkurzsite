import Link from 'next/link';
import styles from '../styles/Header.module.css';

export default function Header({ navLinks = [] }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Josh Kurz | Dad Jokes</h1>
      {navLinks.length > 0 && (
        <nav className={styles.nav}>
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

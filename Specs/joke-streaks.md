Feature: Joke Streaks
User story: As a user, I want to see a streak badge when I rate 3+ jokes in a session so that I feel rewarded for engaging with the site.
Acceptance criteria:
  - [ ] After rating 3 distinct jokes in a single session, show "You're on a streak! 🔥" badge
  - [ ] The badge appears above the rating section once the streak threshold is reached
  - [ ] The streak count persists in sessionStorage (resets on tab/browser close)
  - [ ] Rating the same joke twice does not increment the streak count
  - [ ] Badge remains visible for the rest of the session
Data model: sessionStorage key "jokeStreak" → JSON { count: number, ratedIds: string[] }
Files to change: pages/index.js, styles/Home.module.css
Files to create: Specs/joke-streaks.md, __tests__/pages/jokeStreaks.test.js

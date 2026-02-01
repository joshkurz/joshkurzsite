// scripts/migrate-ratings-to-dynamo.mjs
import { iterateAllRatingEntries } from '../lib/ratingsStorage.js';
import { writeRating } from '../lib/ratingsStorageDynamo.js';

async function migrate() {
  let count = 0;
  for await (const entry of iterateAllRatingEntries()) {
    await writeRating({
      jokeId: entry.jokeId,
      rating: entry.rating,
      joke: entry.joke,
      author: entry.author,
      mode: entry.mode,
      dateKey: entry.date
    });
    count++;
    if (count % 100 === 0) console.log(`Migrated ${count} ratings`);
  }
  console.log(`Migration complete: ${count} ratings`);
}

migrate().catch(console.error);
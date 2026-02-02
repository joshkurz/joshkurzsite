# Agent Instructions

## Environment

You have to write to `/tmp`. You are running in Vercel.

## Database Architecture

See `docs/ARCHITECTURE_SCALABILITY_REVIEW.md` for the full DynamoDB design.

### Key Points

**Single Table Design:** Both ratings AND custom jokes are stored in the same DynamoDB table (`RATINGS_TABLE` / `dad-jokes-ratings-prod`).

### Record Types in RATINGS_TABLE

| Record Type | PK Pattern | SK Pattern | GSI1PK | GSI2PK |
|-------------|-----------|------------|--------|--------|
| Rating | `JOKE#<jokeId>` | `RATING#<timestamp>#<uuid>` | `ALL_RATINGS` | `AUTHOR#<name>` |
| Custom Joke (accepted) | `CUSTOM_JOKE#<id>` | `METADATA` | `CUSTOM_JOKES_ACCEPTED` | `AUTHOR#<name>` |
| Custom Joke (rejected) | `CUSTOM_JOKE#<id>` | `METADATA` | `CUSTOM_JOKES_REJECTED` | - |

### Important: GSI2 Returns Mixed Record Types

When querying `GSI2` by `AUTHOR#<name>`, you will get BOTH:
- Rating records (PK starts with `JOKE#`)
- Custom joke records (PK starts with `CUSTOM_JOKE#`)

**You must filter by PK prefix** when processing results:

```javascript
for (const item of result.Items || []) {
  if (item.PK.startsWith('CUSTOM_JOKE#')) {
    continue // Skip custom joke records when processing ratings
  }
  // Process rating...
}
```

### Stats Table (STATS_TABLE)

Pre-computed aggregations are stored in a separate table (`dad-jokes-stats-prod`):
- `PK: STATS#<jokeId>`, `SK: AGGREGATE` - Per-joke stats
- `PK: GLOBAL`, `SK: AGGREGATE` - Global stats
- `PK: GLOBAL`, `SK: AUTHOR#<name>` - Per-author stats

Stats are updated asynchronously via DynamoDB Streams + Lambda (see `lambda/ratings-aggregator/`).

### S3 is Legacy

S3 storage (`groan-ratings/`, `custom-jokes/`) is legacy. All new data goes to DynamoDB.

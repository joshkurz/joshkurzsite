# Well-Architected Review: Performance

Review joshkurz.net for performance issues and optimization opportunities. This is a live demo – find real problems, not theoretical ones.

## Review Scope

Focus on **measurable performance** across these pillars:
1. API response latency
2. Caching strategy
3. Bundle size and client-side load
4. Data fetching patterns
5. Streaming and concurrency

## Steps

### Step 1 – Read the Hot Paths

Read these files in full before making any recommendations:
- `pages/index.js` – how the client fetches jokes and renders
- `lib/ratingsStorageDynamo.js` – DynamoDB reads/writes and dashboard queries
- `lib/dashboardSummary.js` – TTL-based filesystem caching layer
- `pages/api/random-joke.js`
- `pages/api/ai-joke.js`
- `pages/api/ratings.js`

### Step 2 – Analyze Caching

Answer these questions with specific file:line references:

- How does `ratingsStorageDynamo.js` avoid redundant DynamoDB reads? Are stats truly O(1)?
- Does `dashboardSummary.js` actually prevent redundant DynamoDB queries? What's the TTL?
- Is there any caching on the random-joke endpoint? Should there be?
- What happens to the filesystem cache when a serverless function cold-starts?

### Step 3 – Analyze API Latency

For each API route, identify:
- What external calls does it make (S3, OpenAI)?
- Are external calls made in parallel or sequentially?
- What's the worst-case latency path?
- Are there any N+1 patterns?

### Step 4 – Analyze Client Bundle

Run a quick bundle analysis:
```bash
npm run build 2>&1 | grep -E "(Route|Size|First Load)" | head -40
```

Report what you find. Is the bundle size reasonable? Are there any obvious wins?

### Step 5 – Streaming Performance

Review how AI joke streaming works end-to-end:
- `pages/api/ai-joke.js` → `lib/parseJokeStream.js` → `pages/index.js`
- Is the stream properly piped? Are there any buffering issues?
- Does the UI update incrementally as tokens arrive?

### Step 6 – Deliver the Report

Output a **Performance Report** with this exact format:

```
## Performance Review: joshkurz.net

### 🔴 Critical Issues (fix before launch)
- [issue]: [file:line] – [impact] – [fix]

### 🟡 Moderate Issues (worth fixing)
- [issue]: [file:line] – [impact] – [fix]

### 🟢 Working Well
- [what's good and why]

### Quick Wins (implement in < 30 min)
1. [specific change with code snippet]
2. [specific change with code snippet]

### Metrics to Track
- [what to measure, how]
```

Be specific. Include actual code snippets for recommended fixes. No vague advice.

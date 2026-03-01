# CLAUDE.md - AI Assistant Guide for joshkurzsite

This document provides guidance for AI assistants working with this codebase.

## Project Overview

**Josh Kurz's Dad Jokes Web Application** - A Next.js web platform for sharing, rating, and generating dad jokes using AI. The site features interactive joke displays, a rating system, AI-powered joke generation via OpenAI, user submissions, and an analytics dashboard.

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 13.0.6 |
| UI | React 18.2.0 |
| Styling | CSS Modules |
| AI | OpenAI SDK v5.12.0 (gpt-4o-mini-tts for speech) |
| Storage | AWS DynamoDB (@aws-sdk/client-dynamodb + @aws-sdk/lib-dynamodb) |
| Analytics | React GA (Google Analytics) |
| Testing | Jest 30.0.5, @testing-library/react |
| Linting | ESLint 8.28.0 with next/core-web-vitals |

## Directory Structure

```
/
├── pages/              # Next.js routes and pages
│   ├── api/            # API endpoints (serverless functions)
│   │   ├── random-joke.js   # GET random joke from dataset
│   │   ├── ai-joke.js       # POST AI-generated jokes
│   │   ├── ratings.js       # GET/POST joke ratings
│   │   ├── speak.js         # Text-to-speech generation
│   │   └── custom-jokes.js  # User joke submissions
│   ├── index.js        # Main homepage (600 LOC, class component)
│   ├── speak.js        # Text-to-speech utility page
│   └── dashboard.js    # Analytics dashboard
├── components/         # Reusable React components
│   ├── Header.js       # Navigation header
│   ├── JokeSpeaker.js  # Audio player with loading/error states
│   └── Spinner.js      # Loading spinner (CSS)
├── lib/                # Core business logic
│   ├── dynamoClient.js      # DynamoDB Document Client + table constants
│   ├── ratingsStorageDynamo.js  # Ratings read/write + dashboard queries
│   ├── customJokes.js       # User joke management (DynamoDB)
│   ├── dashboardSummary.js  # Analytics caching (filesystem TTL)
│   ├── openaiClient.js      # OpenAI client setup
│   ├── aiJokeNicknames.js   # AI model naming
│   ├── aiJokePrompt.js      # Prompt engineering
│   ├── jokeInspiration.mjs  # Top-rated jokes for AI inspiration
│   ├── parseJokeStream.js   # Streaming text parser
│   └── jokesData.js         # Joke data loader
├── data/               # Static data files
│   └── fatherhood_jokes.json  # Joke dataset from fatherhood.gov
├── scripts/            # Maintenance scripts
│   ├── fetch-fatherhood-jokes.mjs   # Refresh joke dataset
│   └── update-dashboard-summary.mjs # Generate analytics cache
├── styles/             # CSS Modules
├── __tests__/          # Jest test suite
├── talk/               # Conference talk slides (deployed to GitHub Pages)
└── public/             # Static assets
```

## Development Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
npm run update-dashboard-summary  # Regenerate dashboard analytics cache
```

## Environment Variables

### Required for full functionality:

```bash
# OpenAI (for AI joke generation and speech)
OPENAI_API_KEY        # or API_KEY

# AWS DynamoDB (for ratings persistence)
AWS_REGION            # or AWS_DEFAULT_REGION (default: us-east-1)
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
DYNAMODB_RATINGS_TABLE  # default: dad-jokes-ratings-prod
DYNAMODB_STATS_TABLE    # default: dad-jokes-stats-prod
```

### Optional configuration:

```bash
OPENAI_PRIMARY_MODEL       # Default: gpt-4.1
OPENAI_FALLBACK_MODEL      # Default: gpt-4.1
DASHBOARD_SUMMARY_TTL_MINUTES  # Default: 1440 (24 hours)
MOCK_OPENAI=true           # Use mock data instead of OpenAI
```

### Fallback behavior:
- Without DynamoDB config: ratings writes will fail; reads return empty stats
- Without OpenAI config: AI features will fail, but static jokes still work

## Key Conventions

### Code Style
- Uses class components in main page (pages/index.js) - legacy pattern
- Function components with hooks in other components
- CSS Modules for styling (*.module.css)
- ESLint with Next.js core-web-vitals ruleset

### DynamoDB Data Model

Two tables:

**RATINGS_TABLE** (`dad-jokes-ratings-prod`)
```
PK: JOKE#<jokeId>          SK: RATING#<timestamp>#<uuid>   → rating records
PK: CUSTOM_JOKE#<id>       SK: METADATA                    → custom joke records
GSI1PK: ALL_RATINGS        GSI1SK: <timestamp>             → recent ratings index
GSI2PK: AUTHOR#<name>      GSI2SK: <timestamp>             → author index
```

**STATS_TABLE** (`dad-jokes-stats-prod`)
```
PK: STATS#<jokeId>         SK: AGGREGATE    → pre-computed per-joke stats
PK: GLOBAL                 SK: AGGREGATE    → global totals
PK: GLOBAL                 SK: AUTHOR#<n>   → per-author totals
GSI1PK: TOP_PERFORMERS     GSI1SK: <avg>    → top jokes by average rating
```

Stats are updated asynchronously via DynamoDB Streams + Lambda after each write.
All reads are O(1) GetItem lookups against pre-computed stats.

### API Response Patterns
- Success responses return JSON with data
- Error responses include `error` field with message
- Streaming responses used for AI-generated content

## Testing Guidelines

Run tests with:
```bash
npm test
```

Test files are in `__tests__/` directory covering:
- API endpoints (handlers without HTTP layer)
- React components
- Utility functions

Use `node-mocks-http` for API testing:
```javascript
import { createMocks } from 'node-mocks-http';
const { req, res } = createMocks({ method: 'GET' });
```

## Deployment Notes

**Platform:** Vercel

**Critical:** On Vercel, write temporary files to `/tmp` only, not the local filesystem. The `lib/` modules already handle this with environment detection.

## Common Tasks

### Add a new API endpoint
1. Create file in `pages/api/<endpoint>.js`
2. Export default async handler function
3. Add tests in `__tests__/api/<endpoint>.test.js`

### Refresh joke dataset
```bash
node scripts/fetch-fatherhood-jokes.mjs
```

### Add a new component
1. Create file in `components/<Name>.js`
2. Add styles in `styles/<Name>.module.css`
3. Use PropTypes for prop validation

### Modify AI joke generation
- Prompt template: `lib/aiJokePrompt.js`
- Model nicknames: `lib/aiJokeNicknames.js`
- Client config: `lib/openaiClient.js`
- Inspiration data: `lib/jokeInspiration.mjs` (reads top performers from DynamoDB)

## Important Files

| File | Purpose |
|------|---------|
| `pages/index.js` | Main homepage - joke display, rating UI, submission form |
| `lib/ratingsStorageDynamo.js` | All ratings logic - writes, O(1) reads, dashboard queries |
| `lib/dynamoClient.js` | DynamoDB client singleton + table name constants |
| `lib/openaiClient.js` | OpenAI setup with model fallbacks |
| `data/fatherhood_jokes.json` | Primary joke dataset |
| `next.config.js` | Next.js configuration (React Strict Mode) |

## Troubleshooting

### "Cannot write to filesystem" on Vercel
Use `/tmp` directory for temporary files. Check `VERCEL` env var to detect platform.

### AI features not working
1. Check `OPENAI_API_KEY` is set
2. Check OpenAI API status
3. Try `MOCK_OPENAI=true` for testing without API

### Ratings not persisting
1. Verify AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
2. Check `DYNAMODB_RATINGS_TABLE` and `DYNAMODB_STATS_TABLE` env vars
3. Confirm IAM permissions include `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:Query`

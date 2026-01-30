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
| Storage | AWS S3 (@aws-sdk/client-s3 v3.645.0) |
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
├── lib/                # Core business logic (~1,700 LOC)
│   ├── ratingsStorage.js    # S3/memory rating persistence
│   ├── customJokes.js       # User joke management
│   ├── s3Storage.js         # AWS S3 client operations
│   ├── dashboardSummary.js  # Analytics caching
│   ├── openaiClient.js      # OpenAI client setup
│   ├── aiJokeNicknames.js   # AI model naming
│   ├── aiJokePrompt.js      # Prompt engineering
│   ├── parseJokeStream.js   # Streaming text parser
│   └── jokesData.js         # Joke data loader
├── data/               # Static data files
│   └── fatherhood_jokes.json  # Joke dataset from fatherhood.gov
├── scripts/            # Maintenance scripts
│   ├── fetch-fatherhood-jokes.mjs   # Refresh joke dataset
│   └── update-dashboard-summary.mjs # Generate analytics
├── styles/             # CSS Modules
├── __tests__/          # Jest test suite
└── public/             # Static assets
```

## Development Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
npm run update-dashboard-summary  # Generate dashboard analytics
```

## Environment Variables

### Required for full functionality:

```bash
# OpenAI (for AI joke generation and speech)
OPENAI_API_KEY        # or API_KEY

# AWS S3 (for ratings persistence)
S3_BUCKET_NAME        # or AWS_S3_BUCKET or DAD_AWS_S3_BUCKET
AWS_REGION            # or AWS_DEFAULT_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

### Optional configuration:

```bash
OPENAI_PRIMARY_MODEL       # Default: gpt-4.1
OPENAI_FALLBACK_MODEL      # Default: gpt-4.1
DASHBOARD_SUMMARY_TTL_MINUTES  # Default: 1440 (24 hours)
MOCK_OPENAI=true           # Use mock data instead of OpenAI
```

### Fallback behavior:
- Without S3 config: Falls back to in-memory storage (development mode)
- Without OpenAI config: AI features will fail, but static jokes still work

## Key Conventions

### Code Style
- Uses class components in main page (pages/index.js) - legacy pattern
- Function components with hooks in other components
- CSS Modules for styling (*.module.css)
- ESLint with Next.js core-web-vitals ruleset

### Data Storage Pattern
```
S3 Structure:
├── groan-ratings/YYYY-MM-DD/<joke-id>.json  # Daily ratings
├── custom-jokes/accepted/<id>.json          # Approved submissions
├── custom-jokes/rejected/<id>.json          # Rejected submissions
└── dashboard-summary/...                    # Analytics cache
```

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

## Important Files

| File | Purpose |
|------|---------|
| `pages/index.js` | Main homepage - joke display, rating UI, submission form |
| `lib/ratingsStorage.js` | Core ratings logic, S3 integration, caching |
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
1. Verify S3 credentials
2. Check bucket permissions
3. Falls back to in-memory (lost on restart)

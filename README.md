This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Groan ratings & free storage option

The home page now lets visitors rate each joke on a five groan scale. Ratings are persisted through the `/api/ratings` route, which stores daily aggregates in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob). Each vote is appended to a JSON document located at `groan-ratings/<yyyy-mm-dd>/<joke-id>.json`, making it easy to review stats for a single joke or analyze everything that landed on a specific day.

1. In the Vercel dashboard, create a Blob store (the free hobby tier is plenty for text-sized payloads).
2. Copy the `BLOB_READ_WRITE_TOKEN` from the store settings and expose it to the app:

   ```bash
   BLOB_READ_WRITE_TOKEN=<value>
   ```

3. Redeploy. The `/api/ratings` route will start reading/writing daily JSON blobs. When the token is absent (for example during local development), the route falls back to an in-memory store so the UI can still be exercised.

## Fatherhood.gov joke dataset

The homepage now pulls directly from the public [Fatherhood.gov dad joke library](https://www.fatherhood.gov/for-dads/dad-jokes). A helper script (`scripts/fetch-fatherhood-jokes.mjs`) crawls the JSON:API endpoint, normalizes each joke, and saves them to `data/fatherhood_jokes.json`. The file powers the `/api/random-joke` endpoint, the OpenAI fallback responses, and any other features that need a reliable supply of groan-worthy material. Run the script whenever you want to refresh the dataset:

```bash
node scripts/fetch-fatherhood-jokes.mjs
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

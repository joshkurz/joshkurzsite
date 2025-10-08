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

The home page now lets visitors rate each joke on a five groan scale. Ratings are persisted through the `/api/ratings` route, which is designed to run against [Vercel KV](https://vercel.com/docs/storage/vercel-kv) — Vercel's serverless Redis offering that includes a generous free tier and works seamlessly on Vercel-hosted deployments.

1. In the Vercel dashboard, add a KV store to your project (the free hobby plan is sufficient for a handful of ratings).
2. Copy the generated credentials and expose them to the app as environment variables:

   ```bash
   KV_URL=<value>
   KV_REST_API_URL=<value>
   KV_REST_API_TOKEN=<value>
   KV_REST_API_READ_ONLY_TOKEN=<value>
   ```

3. Redeploy. The `/api/ratings` route will start reading/writing groan counts per joke. When these variables are absent (for example during local development), the route falls back to an in-memory store so the UI can still be exercised.

## Joke of the day mode

If you want to track a single joke over the course of the day, switch the homepage into **Joke of the Day** mode using the toggle above the joke. When active the app:

- Calls `/api/daily-joke`, which fetches "On this day" facts from Wikipedia's public REST API.
- Generates a dad joke that references the selected historical event and caches it in Vercel KV (or an in-memory fallback) so everyone sees the same joke for that date.
- Surfaces the historical context, including a summary and source link, under the joke so you know why the gag is timely.

To make the daily joke the default view on load, set an environment variable before building the app:

```bash
NEXT_PUBLIC_DEFAULT_JOKE_MODE=daily
```

With the variable set, visitors land on the date-aware daily joke but can still switch back to the live streaming mode at any time.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

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

## Groan ratings & PostgreSQL storage

The home page now lets visitors rate each joke on a five groan scale. Ratings, accepted custom jokes, and the seed Fatherhood.gov catalog are stored in PostgreSQL. All API routes read from and write to the database, and the dashboard relies exclusively on aggregate SQL queries to keep traffic lean.

1. Provision a PostgreSQL database (Supabase, Neon, Railway, and Render all work great). Note the connection string.
2. Expose the connection string via one of the supported environment variables:

   ```bash
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   # or POSTGRES_URL / PG_CONNECTION_STRING / SUPABASE_DB_URL / SUPABASE_POSTGRES_URL
   ```

   When running on AWS you can also provide discrete RDS environment variables. Set
   `AWS_RDS_HOST`, `AWS_RDS_USERNAME`, `AWS_RDS_PASSWORD`, `AWS_RDS_DATABASE`, and
   optionally `AWS_RDS_PORT` / `AWS_RDS_SSL` (or the legacy `RDS_*` equivalents) and the
   application will construct a secure PostgreSQL connection string automatically.

3. Redeploy. On first run the app creates the required tables and seeds the `jokes` table from
   `data/fatherhood_jokes.json`. Subsequent requests pull exclusively from PostgreSQL, including the
   `/api/random-joke`, `/api/custom-jokes`, and `/api/ratings` endpoints. If you want to warm the
   database outside of a request cycle, run `npm run db:bootstrap` to create the schema and sync the
   Fatherhood.gov catalog up front.

## Fatherhood.gov joke dataset

The homepage now pulls directly from the public [Fatherhood.gov dad joke library](https://www.fatherhood.gov/for-dads/dad-jokes). A helper script (`scripts/fetch-fatherhood-jokes.mjs`) crawls the JSON:API endpoint, normalizes each joke, and saves them to `data/fatherhood_jokes.json`. On boot the dataset is synchronized into PostgreSQL, which powers `/api/random-joke`, the OpenAI fallback responses, and any other features that need a reliable supply of groan-worthy material. Run the script whenever you want to refresh the dataset:

```bash
node scripts/fetch-fatherhood-jokes.mjs
```

## AWS PostgreSQL with Terraform

The `terraform/` directory provisions a production-ready Amazon RDS PostgreSQL
instance, subnet group, and security group. Supply your AWS credentials and run:

```bash
cd terraform
terraform init
terraform apply -var="db_username=postgres" -var="db_password=super-secret"
```

By default the module targets the default VPC in the selected region. Adjust the
input variables to point at a dedicated VPC or to tighten the allowed CIDR blocks
for database access. The apply output includes a ready-to-use connection string
that you can surface via the environment variables listed above.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

# JoshKurzSite Ratings Infrastructure

This project is a Next.js application that lets visitors rate jokes and review community activity. Ratings are now backed by DynamoDB aggregates with optional SQS fan-out to downstream consumers.

## Prerequisites

- Node.js 18+
- npm 9+
- An AWS account with permissions to manage DynamoDB and SQS
- Terraform 1.4+ (optional, for provisioning)

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Export the required AWS variables (see [Environment variables](#environment-variables)). When AWS is not configured, the API falls back to in-memory counts so you can still iterate on the UI.
3. Start the Next.js dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) to view the site.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `RATINGS_TABLE_NAME` | ✅ | DynamoDB table that stores rating aggregates, recent votes, and event history. |
| `AWS_REGION` | ✅ | AWS region that hosts the table (and queue if enabled). |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | ✅ | Credentials for the IAM principal that can read/write the table. These can also be provided via a named profile or IAM role assumption. |
| `RATINGS_QUEUE_URL` | Optional | SQS queue URL used to fan out rating events. Leave unset to disable queuing. |

If you use a named AWS CLI profile set the `AWS_PROFILE` environment variable before running commands.

## Provisioning with Terraform

A ready-to-use Terraform configuration lives in `infra/terraform`. It creates a DynamoDB table (`pk` / `sk` schema) and an SQS queue with on-demand capacity. To apply it:

```bash
cd infra/terraform
terraform init
terraform apply \
  -var="region=us-east-1" \
  -var="table_name=joshkurzsite-ratings" \
  -var="queue_name=joshkurzsite-ratings-events"
```

After the run completes, export the outputs for your deployment:

```bash
export RATINGS_TABLE_NAME="$(terraform output -raw ratings_table_name)"
export RATINGS_QUEUE_URL="$(terraform output -raw ratings_queue_url)" # optional
export AWS_REGION="us-east-1"
```

Configure the same variables in your hosting environment (e.g. Vercel project settings) so the API routes talk to DynamoDB instead of the in-memory fallback.

## Migrating legacy ratings

Legacy vote payloads can be migrated into DynamoDB with the provided script. Supply a JSON file that contains an array of objects matching the old blob schema (`jokeId`, `rating`, `mode`, `date`, `submittedAt`, etc.). The script writes each record to DynamoDB and skips malformed entries.

```bash
# migrate from a file
npm run migrate:ratings -- --input ./path/to/legacy-ratings.json

# or stream JSON through stdin
cat legacy.json | npm run migrate:ratings -- --input -
```

By default migrations write only to DynamoDB. Pass `--enqueue` if you also want each migrated record sent through SQS.

## Testing

Run Jest to execute the existing unit tests:

```bash
npm test
```

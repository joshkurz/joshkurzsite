# Dad Jokes Infrastructure

Terraform configuration for creating DynamoDB tables and Lambda functions to support scalable joke ratings.

## Prerequisites

- [Terraform](https://terraform.io) >= 1.0.0
- AWS CLI configured with appropriate credentials
- Node.js 20+ (for Lambda function)

## Quick Start

```bash
# Initialize terraform
cd terraform
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply
```

## Resources Created

| Resource | Type | Purpose |
|----------|------|---------|
| `dad-jokes-ratings-{env}` | DynamoDB Table | Stores individual rating records |
| `dad-jokes-stats-{env}` | DynamoDB Table | Stores pre-computed aggregations |
| `dad-jokes-ratings-aggregator-{env}` | Lambda Function | Updates stats when ratings are inserted |
| IAM Role/Policy | IAM | Permissions for Lambda |
| CloudWatch Log Group | Logs | Lambda execution logs |

## Configuration

### Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `environment` | `prod` | Environment name (dev/staging/prod) |
| `aws_region` | `us-east-1` | AWS region |
| `billing_mode` | `PAY_PER_REQUEST` | DynamoDB billing (PAY_PER_REQUEST/PROVISIONED) |
| `lambda_memory_size` | `256` | Lambda memory in MB |
| `lambda_timeout` | `30` | Lambda timeout in seconds |

### Example: Development Environment

```bash
terraform apply -var="environment=dev"
```

### Example: Provisioned Capacity (for predictable workloads)

```bash
terraform apply \
  -var="billing_mode=PROVISIONED" \
  -var="read_capacity=10" \
  -var="write_capacity=10"
```

## Outputs

After applying, terraform outputs the values needed for your application:

```bash
terraform output
```

Add these to your Vercel environment variables:
- `DYNAMODB_RATINGS_TABLE`
- `DYNAMODB_STATS_TABLE`
- `AWS_REGION`

## DynamoDB Data Model

### JokeRatings Table

| Key | Format | Example |
|-----|--------|---------|
| PK (Partition) | `JOKE#<jokeId>` | `JOKE#fatherhood-123` |
| SK (Sort) | `RATING#<timestamp>#<uuid>` | `RATING#2026-01-30T15:30:00Z#abc123` |

**GSI1 (Recent Ratings):**
- PK: `ALL_RATINGS`
- SK: ISO timestamp

**GSI2 (By Author):**
- PK: `AUTHOR#<name>`
- SK: ISO timestamp

### JokeStats Table

| Key | Format | Example |
|-----|--------|---------|
| PK (Partition) | `STATS#<jokeId>` or `GLOBAL` | `STATS#fatherhood-123` |
| SK (Sort) | `AGGREGATE` or `AUTHOR#<name>` | `AGGREGATE` |

**GSI1 (Top Performers):**
- PK: `TOP_PERFORMERS`
- SK: Average rating (number)

## Lambda Function

The `ratings-aggregator` Lambda is triggered by DynamoDB Streams when new ratings are inserted.

It updates:
1. Per-joke stats (`STATS#<jokeId>`)
2. Global stats (`GLOBAL#AGGREGATE`)
3. Per-author stats (`GLOBAL#AUTHOR#<author>`)

### Local Development

```bash
cd lambda/ratings-aggregator
npm install
```

### Updating Lambda Code

After modifying `lambda/ratings-aggregator/index.js`:

```bash
terraform apply  # Automatically re-zips and deploys
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning:** This will delete all data in the DynamoDB tables.

## Cost Estimation

With PAY_PER_REQUEST billing:

| Usage | Monthly Cost |
|-------|--------------|
| 1M ratings written | ~$1.25 |
| 10M reads | ~$2.50 |
| 1GB storage | ~$0.25 |
| Lambda (1M invocations) | ~$0.20 |
| **Total** | **~$4.20** |

## Troubleshooting

### Lambda not triggering

1. Check DynamoDB Streams is enabled: `terraform state show aws_dynamodb_table.joke_ratings`
2. Check event source mapping: `terraform state show aws_lambda_event_source_mapping.ratings_stream`
3. Check CloudWatch Logs for errors

### Stats not updating

1. Verify Lambda is processing events in CloudWatch Logs
2. Check IAM permissions allow DynamoDB access
3. Verify STATS_TABLE_NAME environment variable is set

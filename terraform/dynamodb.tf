# DynamoDB Tables for Dad Jokes Ratings

# =============================================================================
# Table 1: JokeRatings (Individual rating records)
# =============================================================================
# Stores each individual rating submission
# Uses DynamoDB Streams to trigger aggregation Lambda

resource "aws_dynamodb_table" "joke_ratings" {
  name         = "dad-jokes-ratings-${var.environment}"
  billing_mode = var.billing_mode
  hash_key     = "PK"
  range_key    = "SK"

  # Only set capacity for provisioned mode
  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 attributes (recent ratings by time)
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI2 attributes (ratings by author)
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # GSI1: Query recent ratings across all jokes
  # PK: "ALL_RATINGS", SK: ISO timestamp
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"

    read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
    write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  }

  # GSI2: Query ratings by author
  # PK: "AUTHOR#<name>", SK: ISO timestamp
  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"

    read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
    write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  }

  # Enable DynamoDB Streams for event-driven aggregation
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # Point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # TTL for automatic cleanup (optional, disabled by default)
  ttl {
    attribute_name = "expiresAt"
    enabled        = var.ratings_ttl_days > 0
  }
}

# =============================================================================
# Table 2: JokeStats (Pre-computed aggregations)
# =============================================================================
# Stores pre-computed statistics for O(1) reads
# Updated asynchronously via Lambda

resource "aws_dynamodb_table" "joke_stats" {
  name         = "dad-jokes-stats-${var.environment}"
  billing_mode = var.billing_mode
  hash_key     = "PK"
  range_key    = "SK"

  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 attributes (top performers by average rating)
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "N"
  }

  # GSI1: Query top performers sorted by average rating
  # PK: "TOP_PERFORMERS", SK: average rating (number)
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"

    read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
    write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }
}

# =============================================================================
# Lambda Function: Ratings Aggregator
# =============================================================================
# Triggered by DynamoDB Streams when new ratings are written
# Updates pre-computed stats in JokeStats table

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/ratings-aggregator"
  output_path = "${path.module}/.terraform/lambda-ratings-aggregator.zip"
}

resource "aws_lambda_function" "ratings_aggregator" {
  function_name = "dad-jokes-ratings-aggregator-${var.environment}"
  description   = "Aggregates joke ratings from DynamoDB Streams into pre-computed stats"

  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      STATS_TABLE_NAME   = aws_dynamodb_table.joke_stats.name
      RATINGS_TABLE_NAME = aws_dynamodb_table.joke_ratings.name
      NODE_OPTIONS       = "--enable-source-maps"
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_dynamodb,
    aws_cloudwatch_log_group.lambda_logs
  ]
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/dad-jokes-ratings-aggregator-${var.environment}"
  retention_in_days = 14
}

# =============================================================================
# IAM Role and Policies for Lambda
# =============================================================================

resource "aws_iam_role" "lambda_role" {
  name = "dad-jokes-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBTableAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.joke_ratings.arn,
          aws_dynamodb_table.joke_stats.arn,
          "${aws_dynamodb_table.joke_ratings.arn}/index/*",
          "${aws_dynamodb_table.joke_stats.arn}/index/*"
        ]
      },
      {
        Sid    = "DynamoDBStreamAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = [
          aws_dynamodb_table.joke_ratings.stream_arn
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.lambda_logs.arn}:*"
        ]
      }
    ]
  })
}

# =============================================================================
# DynamoDB Stream to Lambda Trigger
# =============================================================================

resource "aws_lambda_event_source_mapping" "ratings_stream" {
  event_source_arn  = aws_dynamodb_table.joke_ratings.stream_arn
  function_name     = aws_lambda_function.ratings_aggregator.arn
  starting_position = "LATEST"

  # Batch settings for efficient processing
  batch_size                         = 100
  maximum_batching_window_in_seconds = 5

  # Process in parallel for higher throughput
  parallelization_factor = 2

  # Error handling
  maximum_retry_attempts             = 3
  maximum_record_age_in_seconds      = 86400  # 24 hours
  bisect_batch_on_function_error     = true

  # Filter to only process INSERT events (new ratings)
  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT"]
      })
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_dynamodb
  ]
}

# IAM Policy for Application DynamoDB Access
resource "aws_iam_policy" "app_dynamodb_access" {
  name        = "dad-jokes-app-dynamodb-${var.environment}"
  description = "Allows the application to read/write ratings and read stats from DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.joke_ratings.arn,
          "${aws_dynamodb_table.joke_ratings.arn}/index/*",
          aws_dynamodb_table.joke_stats.arn,
          "${aws_dynamodb_table.joke_stats.arn}/index/*"
        ]
      }
    ]
  })
}

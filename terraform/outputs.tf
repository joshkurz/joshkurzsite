# Outputs for Dad Jokes Infrastructure
# Use these values to configure the application

output "ratings_table_name" {
  description = "Name of the DynamoDB table for individual ratings"
  value       = aws_dynamodb_table.joke_ratings.name
}

output "ratings_table_arn" {
  description = "ARN of the DynamoDB table for individual ratings"
  value       = aws_dynamodb_table.joke_ratings.arn
}

output "stats_table_name" {
  description = "Name of the DynamoDB table for pre-computed stats"
  value       = aws_dynamodb_table.joke_stats.name
}

output "stats_table_arn" {
  description = "ARN of the DynamoDB table for pre-computed stats"
  value       = aws_dynamodb_table.joke_stats.arn
}

output "ratings_stream_arn" {
  description = "ARN of the DynamoDB Stream for ratings table"
  value       = aws_dynamodb_table.joke_ratings.stream_arn
}

output "lambda_function_name" {
  description = "Name of the ratings aggregator Lambda function"
  value       = aws_lambda_function.ratings_aggregator.function_name
}

output "lambda_function_arn" {
  description = "ARN of the ratings aggregator Lambda function"
  value       = aws_lambda_function.ratings_aggregator.arn
}

# Environment variables to add to Vercel
output "vercel_env_vars" {
  description = "Environment variables to configure in Vercel"
  value = {
    DYNAMODB_RATINGS_TABLE = aws_dynamodb_table.joke_ratings.name
    DYNAMODB_STATS_TABLE   = aws_dynamodb_table.joke_stats.name
    AWS_REGION             = var.aws_region
  }
}

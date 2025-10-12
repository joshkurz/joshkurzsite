output "ratings_table_name" {
  description = "Name of the DynamoDB table that stores rating aggregates"
  value       = aws_dynamodb_table.ratings.name
}

output "ratings_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.ratings.arn
}

output "ratings_queue_url" {
  description = "URL of the SQS queue for rating events"
  value       = aws_sqs_queue.ratings.id
}

output "ratings_queue_arn" {
  description = "ARN of the SQS queue for rating events"
  value       = aws_sqs_queue.ratings.arn
}

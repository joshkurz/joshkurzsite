# Variables for Dad Jokes Infrastructure

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "billing_mode" {
  description = "DynamoDB billing mode (PAY_PER_REQUEST or PROVISIONED)"
  type        = string
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.billing_mode)
    error_message = "Billing mode must be PAY_PER_REQUEST or PROVISIONED"
  }
}

variable "read_capacity" {
  description = "Read capacity units for provisioned mode (ignored for PAY_PER_REQUEST)"
  type        = number
  default     = 5
}

variable "write_capacity" {
  description = "Write capacity units for provisioned mode (ignored for PAY_PER_REQUEST)"
  type        = number
  default     = 5
}

variable "lambda_memory_size" {
  description = "Memory allocation for Lambda function (MB)"
  type        = number
  default     = 256
}

variable "lambda_timeout" {
  description = "Lambda function timeout (seconds)"
  type        = number
  default     = 30
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB tables"
  type        = bool
  default     = true
}

variable "ratings_ttl_days" {
  description = "TTL for daily ratings in days (0 to disable)"
  type        = number
  default     = 0  # Disabled by default - keep all data
}

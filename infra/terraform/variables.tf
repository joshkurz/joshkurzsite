variable "region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "profile" {
  description = "Optional named AWS CLI profile to use"
  type        = string
  default     = null
}

variable "table_name" {
  description = "Name for the DynamoDB table"
  type        = string
  default     = ""
}

variable "queue_name" {
  description = "Name for the SQS queue"
  type        = string
  default     = ""
}

variable "queue_visibility_timeout" {
  description = "Visibility timeout in seconds for the ratings queue"
  type        = number
  default     = 30
}

variable "queue_retention_seconds" {
  description = "Message retention in seconds for the ratings queue"
  type        = number
  default     = 1209600
}

variable "queue_receive_wait" {
  description = "Long polling wait time in seconds"
  type        = number
  default     = 0
}

variable "tags" {
  description = "Additional tags to add to all resources"
  type        = map(string)
  default     = {}
}

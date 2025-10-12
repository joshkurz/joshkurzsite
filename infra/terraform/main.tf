terraform {
  required_version = ">= 1.4.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.region
  profile = var.profile
}

locals {
  table_name = var.table_name != "" ? var.table_name : "groan-ratings"
  queue_name = var.queue_name != "" ? var.queue_name : "groan-ratings-events"
}

resource "aws_dynamodb_table" "ratings" {
  name         = local.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Service = "joshkurzsite-ratings"
  })
}

resource "aws_sqs_queue" "ratings" {
  name                        = local.queue_name
  visibility_timeout_seconds  = var.queue_visibility_timeout
  message_retention_seconds   = var.queue_retention_seconds
  receive_wait_time_seconds   = var.queue_receive_wait
  fifo_queue                  = false
  content_based_deduplication = false

  tags = merge(var.tags, {
    Service = "joshkurzsite-ratings"
  })
}

# Terraform configuration for Dad Jokes Application
# This creates the DynamoDB infrastructure for scalable ratings storage

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  # S3 backend for remote state storage
  backend "s3" {
    bucket       = "dad-jokes-terraform-state-prod"
    key          = "dad-jokes/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "dad-jokes"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

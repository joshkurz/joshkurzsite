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
  region = var.aws_region
}

data "aws_vpc" "selected" {
  count   = var.vpc_id == null ? 1 : 0
  default = true
}

data "aws_vpc" "provided" {
  count = var.vpc_id == null ? 0 : 1
  id    = var.vpc_id
}

locals {
  vpc_id     = coalesce(var.vpc_id, try(data.aws_vpc.provided[0].id, null), try(data.aws_vpc.selected[0].id, null))
  name       = "${var.project}-${var.environment}"
  common_tags = merge({
    "Project"     = var.project,
    "Environment" = var.environment
  }, var.tags)
}

data "aws_subnets" "selected" {
  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-subnets"
  subnet_ids = data.aws_subnets.selected.ids

  tags = local.common_tags
}

resource "aws_security_group" "postgres" {
  name        = "${local.name}-postgres"
  description = "Allow PostgreSQL access for ${local.name}"
  vpc_id      = local.vpc_id

  ingress {
    description      = "PostgreSQL"
    from_port        = 5432
    to_port          = 5432
    protocol         = "tcp"
    cidr_blocks      = var.allowed_cidr_blocks
    ipv6_cidr_blocks = var.allowed_ipv6_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_db_instance" "this" {
  identifier              = "${local.name}-postgres"
  engine                  = "postgres"
  engine_version          = var.db_engine_version
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  max_allocated_storage   = var.db_max_allocated_storage
  storage_type            = "gp3"
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [aws_security_group.postgres.id]
  publicly_accessible     = var.db_publicly_accessible
  multi_az                = var.db_multi_az
  username                = var.db_username
  password                = var.db_password
  db_name                 = var.db_name
  backup_retention_period = var.db_backup_retention_period
  delete_automated_backups = true
  maintenance_window      = var.db_maintenance_window
  backup_window           = var.db_backup_window
  deletion_protection     = var.db_deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
  apply_immediately       = var.apply_immediately
  auto_minor_version_upgrade = true
  storage_encrypted       = true
  performance_insights_enabled = var.performance_insights_enabled
  monitoring_interval          = var.monitoring_interval

  tags = local.common_tags
}

output "db_endpoint" {
  description = "The connection endpoint for the PostgreSQL instance"
  value       = aws_db_instance.this.endpoint
}

output "db_name" {
  description = "The primary database name"
  value       = aws_db_instance.this.db_name
}

output "db_username" {
  description = "Database master username"
  value       = aws_db_instance.this.username
}

output "postgresql_connection_string" {
  description = "Prebuilt PostgreSQL connection string"
  value       = "postgresql://${aws_db_instance.this.username}:${var.db_password}@${aws_db_instance.this.endpoint}/${aws_db_instance.this.db_name}"
  sensitive   = true
}

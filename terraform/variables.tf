variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used for tagging and resource naming"
  type        = string
  default     = "joshkurzsite"
}

variable "environment" {
  description = "Deployment environment label"
  type        = string
  default     = "prod"
}

variable "vpc_id" {
  description = "Optional VPC ID to deploy into. Defaults to the AWS account's default VPC."
  type        = string
  default     = null
}

variable "allowed_cidr_blocks" {
  description = "List of IPv4 CIDR blocks allowed to connect to PostgreSQL"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_ipv6_cidr_blocks" {
  description = "List of IPv6 CIDR blocks allowed to connect to PostgreSQL"
  type        = list(string)
  default     = []
}

variable "db_username" {
  description = "Master username for the PostgreSQL instance"
  type        = string
}

variable "db_password" {
  description = "Master password for the PostgreSQL instance"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Initial database name"
  type        = string
  default     = "dad_jokes"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.5"
}

variable "db_allocated_storage" {
  description = "The amount of storage (in GB) to allocate"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage for autoscaling"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "db_publicly_accessible" {
  description = "Whether the database is publicly accessible"
  type        = bool
  default     = false
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "Sun:05:00-Sun:06:00"
}

variable "db_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the RDS instance"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot on destroy"
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "Apply changes immediately"
  type        = bool
  default     = false
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = false
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0 disables)"
  type        = number
  default     = 0
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

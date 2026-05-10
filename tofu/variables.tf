variable "environment" {
  description = "Environment name used in resource naming (e.g., lab, prod)."
  type        = string
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "swedencentral"
}

variable "container_image" {
  description = "Container image to deploy. Must be pullable when `tofu apply` runs (use a placeholder like 'mcr.microsoft.com/k8se/quickstart:latest' for the very first apply)."
  type        = string
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}

variable "target_port" {
  description = "Port the container listens on. `serve` serves the built SPA on 3000."
  type        = number
  default     = 3000
}

variable "container_cpu" {
  description = "CPU allocation for the container. 0.25 is plenty for an nginx-served SPA."
  type        = number
  default     = 0.25
}

variable "container_memory" {
  description = "Memory allocation for the container (e.g., '0.5Gi', '1Gi')."
  type        = string
  default     = "0.5Gi"
}

variable "min_replicas" {
  description = "Minimum number of container replicas."
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum number of container replicas."
  type        = number
  default     = 3
}

variable "app_secrets" {
  description = "Map of secret names to values to store in Key Vault and expose to the container."
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "env_vars" {
  description = "Additional environment variables for the container."
  type = list(object({
    name        = string
    value       = optional(string)
    secret_name = optional(string)
  }))
  default = []
}

variable "basic_auth_user" {
  description = "HTTP Basic auth username used by the Container App. Set in a gitignored `*.auto.tfvars` file (e.g. `secrets.auto.tfvars`) so the value never lands in the public repo."
  type        = string
  sensitive   = true
}

variable "basic_auth_password" {
  description = "HTTP Basic auth password — stored in Key Vault as `basic-auth-password` and exposed to the Container App as the `BASIC_AUTH_PASSWORD` env var. Set in a gitignored `*.auto.tfvars` file so the value never lands in the public repo."
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default = {
    ManagedBy = "OpenTofu"
  }
}

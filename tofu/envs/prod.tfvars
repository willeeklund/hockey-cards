# gota-off-ice — prod environment

environment = "prod"
location    = "swedencentral"

# First apply uses the public quickstart image so the Container App resource
# can be created before the cards image exists in ACR. The quickstart listens
# on port 80, not 3000, so the TCP probe on 3000 will fail on this first
# apply — the Container App resource still gets created. After the first
# apply, build & push the cards image and set this to:
#   container_image = "crwilleeklund.azurecr.io/gota-off-ice:latest"
# Re-run `tofu apply` and probes will start passing.
container_image = "mcr.microsoft.com/k8se/quickstart:latest"

target_port      = 3000
container_cpu    = 0.25
container_memory = "0.5Gi"

min_replicas = 0
max_replicas = 1

# Custom domain / DNS will be added in a later step.
custom_domain_name = "gota-off-ice.wilhelmeklund.com"

tags = {
  Environment = "prod"
  ManagedBy   = "OpenTofu"
  Application = "gota-off-ice"
}

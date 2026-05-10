# gota-off-ice — self-contained infrastructure
#
# Creates everything from scratch in the target subscription:
#   - Resource Group
#   - Log Analytics Workspace
#   - Container App Environment
#   - Azure Container Registry (ACR)
#   - Key Vault (RBAC mode) + role assignments
#   - Storage Account + private blob container
#   - Managed Identity (used by the Container App for ACR / KV / Storage access)
#   - Container App
#
# Custom domain / DNS will be added in a later step.
#
# No external modules, no shared remote state. State is local by default —
# see tofu/README.md for migrating to a remote backend in the same subscription.

locals {
  app_name = "gota-off-ice"

  # Storage / ACR names must be lowercase alphanumeric only (no hyphens, no
  # underscores). Storage is per-environment; ACR is shared across envs.
  flat_app_name        = replace(local.app_name, "-", "")
  storage_account_name = "st${local.flat_app_name}${var.environment}"
  acr_name             = "crwilleeklund"
}

# ---------------------------------------------------------------------------
# Resource Group
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "this" {
  name     = "rg-${local.app_name}-${var.environment}"
  location = var.location
  tags     = var.tags
}

# ---------------------------------------------------------------------------
# Log Analytics + Container App Environment
# ---------------------------------------------------------------------------

resource "azurerm_log_analytics_workspace" "this" {
  name                = "log-${local.app_name}-${var.environment}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_container_app_environment" "this" {
  name                       = "cae-${local.app_name}-${var.environment}"
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  tags                       = var.tags
}

# ---------------------------------------------------------------------------
# Container Registry
# ---------------------------------------------------------------------------

resource "azurerm_container_registry" "this" {
  name                = local.acr_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = var.tags
}

# ---------------------------------------------------------------------------
# Managed Identity for the Container App
# ---------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${local.app_name}-${var.environment}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = var.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.this.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# ---------------------------------------------------------------------------
# Storage Account + blob container
# ---------------------------------------------------------------------------

resource "azurerm_storage_account" "this" {
  name                            = local.storage_account_name
  resource_group_name             = azurerm_resource_group.this.name
  location                        = azurerm_resource_group.this.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  tags                            = var.tags
}

resource "azurerm_storage_container" "files" {
  name                  = "files"
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

resource "azurerm_role_assignment" "storage_blob_data_contributor" {
  scope                = azurerm_storage_account.this.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# ---------------------------------------------------------------------------
# Key Vault (RBAC mode)
# ---------------------------------------------------------------------------

resource "azurerm_key_vault" "this" {
  name                          = "kv-${local.app_name}-${var.environment}"
  location                      = azurerm_resource_group.this.location
  resource_group_name           = azurerm_resource_group.this.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  public_network_access_enabled = true
  purge_protection_enabled      = false

  network_acls {
    default_action = "Allow"
    bypass         = "AzureServices"
  }

  tags = var.tags
}

# Whoever runs `tofu apply` needs admin rights to write secrets.
resource "azurerm_role_assignment" "kv_admin_deployer" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Container App identity reads secrets at runtime.
resource "azurerm_role_assignment" "kv_secrets_user" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# Wait for RBAC propagation before writing secrets — Azure can take 30-60s
# to make a role assignment effective.
resource "time_sleep" "wait_for_kv_rbac" {
  depends_on      = [azurerm_role_assignment.kv_admin_deployer]
  create_duration = "60s"
}

# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------

resource "azurerm_key_vault_secret" "storage_key" {
  name         = "storage-account-key"
  value        = azurerm_storage_account.this.primary_access_key
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [time_sleep.wait_for_kv_rbac]
}

# var.app_secrets is sensitive, so for_each can't iterate it directly.
# Pull keys with nonsensitive() and look up values via indexing.
resource "azurerm_key_vault_secret" "app_secrets" {
  for_each = toset(nonsensitive(keys(var.app_secrets)))

  name         = each.key
  value        = var.app_secrets[each.key]
  key_vault_id = azurerm_key_vault.this.id

  depends_on = [time_sleep.wait_for_kv_rbac]
}

# ---------------------------------------------------------------------------
# Container App
# ---------------------------------------------------------------------------

resource "azurerm_container_app" "this" {
  name                         = "ca-${local.app_name}-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = azurerm_resource_group.this.name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = azurerm_container_registry.this.login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  dynamic "secret" {
    for_each = azurerm_key_vault_secret.app_secrets
    content {
      name                = secret.value.name
      key_vault_secret_id = secret.value.versionless_id
      identity            = azurerm_user_assigned_identity.app.id
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.target_port
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = local.app_name
      image  = var.container_image
      cpu    = var.container_cpu
      memory = var.container_memory

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "PORT"
        value = tostring(var.target_port)
      }
      env {
        name  = "STORAGE_ACCOUNT"
        value = azurerm_storage_account.this.name
      }
      env {
        name  = "STORAGE_CONTAINER"
        value = azurerm_storage_container.files.name
      }
      env {
        name  = "AZURE_CLIENT_ID"
        value = azurerm_user_assigned_identity.app.client_id
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name        = env.value.name
          value       = env.value.value
          secret_name = env.value.secret_name
        }
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = var.target_port
        path                    = "/health"
        interval_seconds        = 10
        timeout                 = 3
        failure_count_threshold = 3
        success_count_threshold = 1
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = var.target_port
        path                    = "/health"
        interval_seconds        = 30
        timeout                 = 3
        failure_count_threshold = 3
      }
    }
  }

  depends_on = [
    azurerm_role_assignment.acr_pull,
    azurerm_role_assignment.kv_secrets_user,
  ]
}


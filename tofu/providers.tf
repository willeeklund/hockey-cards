provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }

  # Register `Microsoft.App` (Container Apps) on first apply against a fresh
  # subscription. The other namespaces we use (Microsoft.KeyVault,
  # Microsoft.Storage, Microsoft.ContainerRegistry, Microsoft.ManagedIdentity,
  # Microsoft.OperationalInsights, Microsoft.Network) are in the default
  # "legacy" registration set and don't need to be listed here.
  resource_providers_to_register = ["Microsoft.App"]
}

output "resource_group_name" {
  description = "Resource group containing all gota-off-ice resources."
  value       = azurerm_resource_group.this.name
}

output "container_app_name" {
  description = "Name of the Container App."
  value       = azurerm_container_app.this.name
}

output "container_app_url" {
  description = "Default HTTPS URL of the Container App."
  value       = "https://${azurerm_container_app.this.ingress[0].fqdn}"
}

output "container_app_fqdn" {
  description = "FQDN of the Container App ingress (use as the CNAME target)."
  value       = azurerm_container_app.this.ingress[0].fqdn
}

output "acr_name" {
  description = "Name of the Azure Container Registry."
  value       = azurerm_container_registry.this.name
}

output "acr_login_server" {
  description = "Login server hostname for the ACR (use with `docker push`)."
  value       = azurerm_container_registry.this.login_server
}

output "image_repository" {
  description = "Full image path to push to (append a tag)."
  value       = "${azurerm_container_registry.this.login_server}/gota-off-ice"
}

output "key_vault_name" {
  description = "Name of the Key Vault."
  value       = azurerm_key_vault.this.name
}

output "managed_identity_client_id" {
  description = "Client ID of the user-assigned managed identity (set as AZURE_CLIENT_ID inside the container)."
  value       = azurerm_user_assigned_identity.app.client_id
}

output "managed_identity_principal_id" {
  description = "Principal/object ID of the user-assigned managed identity."
  value       = azurerm_user_assigned_identity.app.principal_id
}

output "storage_account_name" {
  description = "Name of the storage account."
  value       = azurerm_storage_account.this.name
}

output "storage_container_name" {
  description = "Default blob container name."
  value       = azurerm_storage_container.files.name
}


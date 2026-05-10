# gota-off-ice — Infrastructure (OpenTofu)

Self-contained Azure infrastructure for the cards app, deployed under the
Azure name `gota-off-ice`. No shared resources, no external modules. Custom
domain / DNS isn't wired up yet — the app is reachable on its default
`*.azurecontainerapps.io` URL.

## Prerequisites

- OpenTofu ≥ 1.6
- Azure CLI, signed in: `az login` (Owner role on the subscription)

## First-time deploy

```bash
cd tofu
tofu init
tofu apply -var-file=envs/prod.tfvars
```

State is local (`tofu/terraform.tfstate`).

## Basic auth credentials

Username and password come from `secrets.auto.tfvars`, which is **gitignored**
— no secret values land in this public repo. Anyone running `tofu apply` must
have their own local copy of that file:

```hcl
# tofu/secrets.auto.tfvars  (NOT committed)
basic_auth_user     = "..."
basic_auth_password = "..."
```

Both values are mirrored into Key Vault as secrets `basic-auth-username` and
`basic-auth-password`, and surfaced to the Container App via `secret_name`
env references. Verify the deployed values any time with:

```bash
az keyvault secret show --vault-name kv-gota-off-ice-prod \
  --name basic-auth-username --query value -o tsv
az keyvault secret show --vault-name kv-gota-off-ice-prod \
  --name basic-auth-password --query value -o tsv
```

## Redeploying app code

Use the Makefile at the repo root — not tofu:

```bash
make manual-deploy
```

That handles ACR auth, builds & pushes `linux/amd64`, and rolls a new
Container App revision. The image reference in `envs/prod.tfvars` stays at
`:latest`, so this doesn't cause tofu drift.

## Destroy

```bash
tofu destroy -var-file=envs/prod.tfvars
```

Soft-deleted Key Vaults linger for 90 days — `az keyvault purge --name
kv-gota-off-ice-prod` if you need to recreate immediately.

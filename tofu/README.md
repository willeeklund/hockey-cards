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

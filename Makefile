# ──────────────────────────────────────────────────────────────────────
# Manual deploy of the cards SPA to Azure Container Apps.
#
#   make manual-deploy   # log in → build & push (linux/amd64) → roll revision
#   make url             # print the public URL
#   make logs            # follow Container App logs
#
# Prerequisite: `az login` to the target subscription. The Makefile uses
# `az acr login` to authenticate Docker against the ACR — no extra creds.
# ──────────────────────────────────────────────────────────────────────

ACR_NAME          := crwilleeklund
ACR_LOGIN_SERVER  := $(ACR_NAME).azurecr.io
IMAGE_NAME        := gota-off-ice
RESOURCE_GROUP    := rg-gota-off-ice-prod
CONTAINER_APP     := ca-gota-off-ice-prod
STORAGE_ACCOUNT   := stgotaofficeprod
STORAGE_CONTAINER := files
KEY_VAULT         := kv-gota-off-ice-prod

# Tag with the short git SHA (or "manual" outside a git checkout) so each
# pushed image is traceable. Also tag :latest — that's the reference in
# tfvars, so no tofu drift after a manual deploy.
GIT_SHA         := $(shell git rev-parse --short HEAD 2>/dev/null || echo manual)
GIT_BRANCH      := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
TIMESTAMP       := $(shell date -u +%Y%m%d%H%M%S)
BUILD_TIME      := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
TAG             := $(GIT_SHA)
REVISION_SUFFIX := $(GIT_SHA)-$(TIMESTAMP)

FULL_IMAGE   := $(ACR_LOGIN_SERVER)/$(IMAGE_NAME):$(TAG)
LATEST_IMAGE := $(ACR_LOGIN_SERVER)/$(IMAGE_NAME):latest

.PHONY: manual-deploy acr-login build-push update-container-app pull-images url logs help

manual-deploy: acr-login build-push update-container-app  ## Full pipeline: log in → build & push → roll new revision

acr-login:  ## az acr login to $(ACR_NAME)
	@echo "→ az acr login --name $(ACR_NAME)"
	az acr login --name $(ACR_NAME)

build-push:  ## docker buildx (linux/amd64) → push :$(TAG) and :latest
	@echo "→ Building & pushing $(FULL_IMAGE) (also tagging :latest)"
	docker buildx build \
	  --platform linux/amd64 \
	  --build-arg GIT_COMMIT=$(GIT_SHA) \
	  --build-arg GIT_BRANCH=$(GIT_BRANCH) \
	  --build-arg BUILD_TIME=$(BUILD_TIME) \
	  -t $(FULL_IMAGE) \
	  -t $(LATEST_IMAGE) \
	  --push \
	  .

update-container-app:  ## Roll a new revision (suffix = git-sha + timestamp)
	@echo "→ Rolling new revision on $(CONTAINER_APP) (suffix=$(REVISION_SUFFIX))"
	az containerapp update \
	  --name $(CONTAINER_APP) \
	  --resource-group $(RESOURCE_GROUP) \
	  --image $(LATEST_IMAGE) \
	  --revision-suffix $(REVISION_SUFFIX) \
	  --output none
	@echo "→ Active revisions:"
	@az containerapp revision list \
	  --name $(CONTAINER_APP) \
	  --resource-group $(RESOURCE_GROUP) \
	  --query "[?properties.active].{name:name, replicas:properties.replicas, trafficWeight:properties.trafficWeight}" \
	  --output table

BLOB_PREFIX := public/exercise_images
PULL_PATTERN := $(if $(TEAM),$(BLOB_PREFIX)/$(TEAM)/*,$(BLOB_PREFIX)/*)

pull-images:  ## Pull uploaded images from blob storage → public/exercise_images/ (optional: TEAM=<id> to limit to one team)
	@echo "→ Downloading blobs matching '$(PULL_PATTERN)' from $(STORAGE_ACCOUNT)/$(STORAGE_CONTAINER)"
	@az storage blob download-batch \
	  --account-name $(STORAGE_ACCOUNT) \
	  --account-key "$$(az keyvault secret show --vault-name $(KEY_VAULT) --name storage-account-key --query value -o tsv)" \
	  --source $(STORAGE_CONTAINER) \
	  --destination . \
	  --pattern '$(PULL_PATTERN)' \
	  --output none
	@echo "→ Done. Run 'git status public/exercise_images/' to see what's new or changed and pick what to commit."

url:  ## Print the public Container App URL
	@az containerapp show \
	  --name $(CONTAINER_APP) \
	  --resource-group $(RESOURCE_GROUP) \
	  --query "properties.configuration.ingress.fqdn" \
	  --output tsv | sed 's|^|https://|'

logs:  ## Follow Container App logs
	az containerapp logs show \
	  --name $(CONTAINER_APP) \
	  --resource-group $(RESOURCE_GROUP) \
	  --follow

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help

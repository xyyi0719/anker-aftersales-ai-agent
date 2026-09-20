#!/bin/sh
set -eu
# Existing deployment paths from the original workflow.
ROOT=/home/ubuntu
MAIN_COMPOSE=$ROOT/dify/docker/docker-compose.yaml
STAGING=$(mktemp -d "$ROOT/anker-deploy.XXXXXX")
trap 'rm -rf "$STAGING"; rm -f /tmp/workbench-deploy.tar.gz' EXIT
DEPLOY=$ROOT/workbench-deploy
SERVICES=$ROOT/anker-demo-services
tar -xzf /tmp/workbench-deploy.tar.gz -C "$STAGING"
# Keep the previous front-end release available for rollback.
if [ -d "$DEPLOY/dist" ]; then
  BACKUP=$(mktemp -d "$ROOT/workbench-backup.XXXXXX")
  cp -R "$DEPLOY/dist" "$BACKUP/dist"
  cp "$DEPLOY/nginx.conf" "$BACKUP/nginx.conf"
fi
mkdir -p "$SERVICES" "$DEPLOY"
cp -R "$STAGING/services/." "$SERVICES/"
DIFY_NETWORK=$(docker inspect anker-workbench --format '{{range $key, $value := .NetworkSettings.Networks}}{{println $key}}{{end}}' | head -n 1)
[ -n "$DIFY_NETWORK" ] || { echo 'Cannot determine existing Dify network'; exit 1; }
export DIFY_NETWORK
FRONT_IMAGE=$(docker inspect anker-workbench --format '{{.Config.Image}}')
docker run --rm --network "$DIFY_NETWORK" -v "$STAGING/nginx.conf:/etc/nginx/conf.d/default.conf:ro" "$FRONT_IMAGE" nginx -t
cd "$SERVICES"
docker compose -p anker-demo -f docker/services/docker-compose.addon.yml up -d --build --wait --wait-timeout 120
# Move out old assets before copying, preserving a rollback directory above.
if [ -d "$DEPLOY/dist" ]; then mv "$DEPLOY/dist" "$STAGING/old-dist-$(date +%s)"; fi
cp -R "$STAGING/dist" "$DEPLOY/dist"
cp "$STAGING/nginx.conf" "$DEPLOY/nginx.conf"
# Recreate: bind mounts must pick up the new file inode.
if ! docker compose -f "$MAIN_COMPOSE" up -d --force-recreate --no-deps anker-workbench; then
  echo "Frontend startup failed; previous release: ${BACKUP:-none}"
  exit 1
fi
sleep 3
if ! docker exec anker-workbench nginx -t || ! curl --fail --retry 5 --retry-delay 2 http://localhost:5173/healthz || ! curl --fail --silent --output /dev/null http://localhost:5173/; then
  if [ -n "${BACKUP:-}" ]; then
    mv "$DEPLOY/dist" "$STAGING/failed-dist"
    cp -R "$BACKUP/dist" "$DEPLOY/dist"
    cp "$BACKUP/nginx.conf" "$DEPLOY/nginx.conf"
    docker compose -f "$MAIN_COMPOSE" up -d --force-recreate --no-deps anker-workbench
    echo 'Frontend restored to previous release after health-check failure.'
  fi
  exit 1
fi
# API reachability from the existing workbench network; no policy/LLM requests.
docker compose -p anker-demo -f docker/services/docker-compose.addon.yml exec -T mock-apis python /app/healthcheck.py 8002
echo 'Frontend + Mock + offline retrieval deployment checks passed. Import Dify YAML manually.'

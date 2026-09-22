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
python3 "$STAGING/scripts/render_nginx.py" "$STAGING/nginx.conf"
unset DIFY_API_KEY
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
# 基础镜像预检：registry-mirrors 里有坏加速器时，BuildKit 解析 FROM 会拿到 text/html 而失败，
# 报错（unknown type text/html）很难定位，而且 plain docker pull 也可能拉到被污染的层。
# 这里先用明确可用的镜像地址预拉一次；实在拿不到就跳过重建、沿用已有镜像，保证前端仍能发布。
BASE_MIRROR=${ANKER_BASE_MIRROR:-docker.m.daocloud.io/library}
BUILD_FLAG=--build
if docker image inspect python:3.11-slim >/dev/null 2>&1; then
  echo 'base image python:3.11-slim: local OK'
elif docker pull "$BASE_MIRROR/python:3.11-slim" && docker tag "$BASE_MIRROR/python:3.11-slim" python:3.11-slim; then
  echo "base image python:3.11-slim: pulled from $BASE_MIRROR OK"
else
  echo 'WARNING: 无法获取基础镜像 python:3.11-slim（多为 /etc/docker/daemon.json 的 registry-mirrors 异常）'
  if docker image inspect anker-demo-mock-apis:latest >/dev/null 2>&1; then
    echo 'WARNING: 本次跳过服务镜像重建，沿用已有 anker-demo-* 镜像；服务代码可能不是最新'
    BUILD_FLAG=''
  else
    echo 'FATAL: 既无基础镜像也无可用服务镜像，无法构建服务；请修复 registry-mirrors 后重试'
    exit 1
  fi
fi
cd "$SERVICES"
docker compose -p anker-demo -f docker/services/docker-compose.addon.yml up -d $BUILD_FLAG --wait --wait-timeout 120
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

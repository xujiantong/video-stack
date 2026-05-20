#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  echo "缺少 .env，请在服务器 $ROOT_DIR/.env 配置生产环境变量。" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> 安装依赖"
pnpm install --frozen-lockfile

echo "==> 数据库迁移"
pnpm --filter studio-api db:migrate

echo "==> 启动/重启 PM2 服务"
if ! command -v pm2 >/dev/null 2>&1; then
  pnpm dlx pm2@latest startOrReload ecosystem.config.cjs --update-env
  pnpm dlx pm2@latest save
else
  pm2 startOrReload ecosystem.config.cjs --update-env
  pm2 save
fi

echo "==> 服务状态"
if command -v pm2 >/dev/null 2>&1; then
  pm2 status video-stack-api video-stack-worker
else
  pnpm dlx pm2@latest status video-stack-api video-stack-worker
fi

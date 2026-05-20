#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${DEPLOY_TARGET:?请设置 DEPLOY_TARGET，例如 user@1.2.3.4}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/video-stack}"
SSH_PORT="${SSH_PORT:-22}"

echo "==> 本地构建 Web"
cd "$ROOT_DIR"
pnpm install --frozen-lockfile
pnpm --filter studio-web build

echo "==> 检查服务器目录和 .env"
ssh -p "$SSH_PORT" "$DEPLOY_TARGET" "mkdir -p '$DEPLOY_PATH' && test -f '$DEPLOY_PATH/.env' || (echo '服务器缺少 $DEPLOY_PATH/.env，请先创建生产环境变量文件。' >&2; exit 1)"

echo "==> 同步代码和本地构建产物到服务器"
rsync -az --delete \
  -e "ssh -p $SSH_PORT" \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude ".env" \
  --exclude ".DS_Store" \
  --exclude "coverage/" \
  --exclude "test-results/" \
  --exclude "playwright-report/" \
  "$ROOT_DIR/" "$DEPLOY_TARGET:$DEPLOY_PATH/"

echo "==> 服务器安装依赖、迁移并重启服务"
ssh -p "$SSH_PORT" "$DEPLOY_TARGET" "cd '$DEPLOY_PATH' && bash scripts/server-start.sh"

echo "==> 部署完成"

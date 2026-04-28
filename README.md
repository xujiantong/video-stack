# 影栈 Studio

影栈 Studio 是视频生成工作台 MVP。当前版本支持素材上传、Prompt 素材引用、费用预估、二次确认、生成任务队列、Worker 处理流程、即梦 Provider 适配层和深色工作台界面。

## 快速启动

准备环境：

```bash
pnpm install
cp .env.example .env
docker compose up -d
```

生成 32 字节 Base64 密钥，并写入 `.env`：

```bash
openssl rand -base64 32
```

执行数据库迁移：

```bash
set -a
source .env
set +a
pnpm --filter studio-api db:migrate
```

启动 Web、API 和 Worker：

```bash
pnpm dev
```

Web 使用 Vite 输出的本地地址，通常是 `http://localhost:5173`。API 默认监听 `http://localhost:4000`。Worker 连接 `.env` 中的 `REDIS_URL`。

## 环境变量

| 变量 | 用途 | 本地默认值 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgres://studio:studio@localhost:5432/studio` |
| `REDIS_URL` | BullMQ Redis 连接串 | `redis://localhost:6379` |
| `STUDIO_SECRET_KEY_BASE64` | AES-256-GCM 主密钥，必须是 32 字节 Base64 | 手动生成 |
| `STUDIO_STORAGE_MODE` | 素材存储模式：`local` 或 `s3` | `local` |
| `STUDIO_STORAGE_BUCKET` | 对象存储桶名 | `studio-assets` |
| `STUDIO_S3_ENDPOINT` | S3 兼容对象存储地址 | 使用 `s3` 时必填 |
| `STUDIO_S3_REGION` | S3 区域 | `auto` |
| `STUDIO_S3_ACCESS_KEY_ID` | S3 Access Key | 使用 `s3` 时必填 |
| `STUDIO_S3_SECRET_ACCESS_KEY` | S3 Secret Key | 使用 `s3` 时必填 |
| `PORT` | API 监听端口 | `4000` |

即梦 API Key 和 Secret Key 由用户在工作台的 API 设置页保存。前端不会持久化 Secret Key，后端只保存加密后的 Secret Key。

## 服务依赖

`docker-compose.yml` 启动 PostgreSQL 和 Redis：

```bash
docker compose up -d
docker compose ps
```

本地快速验证可使用 `STUDIO_STORAGE_MODE=local`。部署到共享环境时，改用 `STUDIO_STORAGE_MODE=s3`，并配置 S3 兼容对象存储。对象存储账号只需要目标 bucket 的读写权限。

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter studio-web e2e
```

单独启动服务：

```bash
pnpm --filter studio-web dev
pnpm --filter studio-api dev
pnpm --filter studio-worker dev
```

## 部署文档

完整部署步骤见 [docs/deployment.md](docs/deployment.md)。

## 工作区结构

```text
apps/studio-web       工作台界面
apps/studio-api       任务 API、数据 schema、凭证加密
apps/studio-worker    生成任务 Worker
packages/shared       前后端共享 Zod 契约
packages/provider-jimeng 即梦 Provider 适配层
```

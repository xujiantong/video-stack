# 影栈 Studio 部署与运行

本文说明如何启动、验证和部署影栈 Studio。命令默认在仓库根目录执行。

## 1. 准备运行环境

安装依赖：

```bash
pnpm install
```

创建环境变量文件：

```bash
cp .env.example .env
```

生成服务端加密主密钥：

```bash
openssl rand -base64 32
```

把输出写入 `.env` 的 `STUDIO_SECRET_KEY_BASE64`。生产环境必须使用密钥管理系统保存该值。不要提交 `.env`。

## 2. 配置环境变量

基础变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串。API 迁移和服务启动都会读取它。 |
| `REDIS_URL` | 是 | Redis 连接串。API 投递 BullMQ 队列，Worker 消费队列。 |
| `STUDIO_SECRET_KEY_BASE64` | 是 | 32 字节 Base64。后端用它加密 Provider Secret Key。 |
| `PORT` | 否 | API 端口，默认 `4000`。 |

对象存储变量：

| 变量 | 必填条件 | 说明 |
| --- | --- | --- |
| `STUDIO_STORAGE_MODE` | 是 | `local` 用于本地验证，`s3` 用于共享环境。 |
| `STUDIO_STORAGE_BUCKET` | 是 | 素材和生成结果的 bucket 名。 |
| `STUDIO_S3_ENDPOINT` | `s3` 模式必填 | S3 兼容 Endpoint。 |
| `STUDIO_S3_REGION` | `s3` 模式必填 | S3 区域。未知区域可用 `auto`。 |
| `STUDIO_S3_ACCESS_KEY_ID` | `s3` 模式必填 | 对象存储 Access Key。 |
| `STUDIO_S3_SECRET_ACCESS_KEY` | `s3` 模式必填 | 对象存储 Secret Key。 |

即梦凭证不放在 `.env` 中。用户进入 Web 后，在 API 设置页保存 API Key、Secret Key、服务区域和默认模型。API 只返回脱敏凭证。

## 3. 启动基础服务

本地启动 PostgreSQL 和 Redis：

```bash
docker compose up -d
docker compose ps
```

默认端口：

| 服务 | 地址 |
| --- | --- |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

如果端口被占用，修改 `docker-compose.yml` 的宿主机端口，并同步修改 `.env`。

## 4. 执行数据库迁移

加载环境变量：

```bash
set -a
source .env
set +a
```

执行迁移：

```bash
pnpm --filter studio-api db:migrate
```

迁移会创建 `users`、`projects`、`assets`、`provider_credentials` 和 `generation_tasks`。

## 5. 启动开发环境

同时启动 Web、API 和 Worker：

```bash
pnpm dev
```

单独启动：

```bash
pnpm --filter studio-web dev
pnpm --filter studio-api dev
pnpm --filter studio-worker dev
```

Web 通常运行在 `http://localhost:5173`。Vite 会把 `/api` 代理到 `http://127.0.0.1:4000`。API 健康检查地址是 `http://localhost:4000/health`。

## 6. 验证

运行全量验证：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter studio-web e2e
```

E2E 会启动 Vite preview，默认地址是 `http://127.0.0.1:4173`。

## 7. 部署

部署时拆成三个进程：

| 进程 | 构建命令 | 启动命令 |
| --- | --- | --- |
| Web | `pnpm --filter studio-web build` | 托管 `apps/studio-web/dist`，或执行 `pnpm --filter studio-web preview` |
| API | `pnpm --filter studio-api build` | `pnpm --filter studio-api start` |
| Worker | `pnpm --filter studio-worker build` | `pnpm --filter studio-worker start` |

生产环境部署前先执行：

```bash
pnpm --filter studio-api db:migrate
pnpm build
```

生产环境必须配置 PostgreSQL、Redis、S3 兼容对象存储和稳定的 `STUDIO_SECRET_KEY_BASE64`。API 与 Worker 必须使用同一组 `DATABASE_URL`、`REDIS_URL` 和 `STUDIO_SECRET_KEY_BASE64`。

## 8. 常见错误

`STUDIO_SECRET_KEY_BASE64 必须是 32 字节 Base64 密钥`  
重新运行 `openssl rand -base64 32`，把完整输出写入 `.env`。

`psql: command not found`  
安装 PostgreSQL 客户端，或在带有 `psql` 的容器中执行迁移。

`ECONNREFUSED 127.0.0.1:4000`  
API 未启动，或 `PORT` 与 Vite 代理不一致。先访问 `/health`。

`缺少 STUDIO_S3_ENDPOINT`  
当前使用 `STUDIO_STORAGE_MODE=s3`，但没有配置对象存储。补齐 S3 变量，或改回 `local`。

`Redis connection failed`  
确认 `docker compose ps` 中 Redis 正常运行，并检查 `REDIS_URL`。

`凭证无效`  
在 API 设置页重新保存即梦 API Key 和 Secret Key。保存后再测试连接。

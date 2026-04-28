# 影栈 Studio

影栈 Studio 是视频生成工作台 MVP。它包含 Web 工作台、任务 API、生成 Worker、共享契约和即梦 Provider 适配层。

## 环境要求

- Node.js 22
- pnpm 9.15
- Docker Desktop
- PostgreSQL 客户端 `psql`

## 本地启动

```bash
pnpm install
cp .env.example .env
docker compose up -d
export $(grep -v '^#' .env | xargs)
pnpm --filter studio-api db:migrate
pnpm dev
```

服务默认地址：

- Web：Vite 输出的本地地址，通常是 `http://localhost:5173`
- API：`http://localhost:4000`
- Redis：`redis://localhost:6379`
- PostgreSQL：`postgres://studio:studio@localhost:5432/studio`
- MinIO 控制台：`http://localhost:9001`，账号 `studio`，密码 `studio-secret`

## 环境变量

| 变量 | 用途 | 本地默认值 |
| --- | --- | --- |
| `DATABASE_URL` | API 连接 PostgreSQL | `postgres://studio:studio@localhost:5432/studio` |
| `REDIS_URL` | API 和 Worker 连接 BullMQ | `redis://localhost:6379` |
| `STUDIO_SECRET_KEY_BASE64` | AES-256-GCM 加密凭证密钥 | 32 字节 Base64 字符串 |
| `STUDIO_STORAGE_MODE` | 素材存储模式，支持 `local`、`s3` | `local` |
| `STUDIO_STORAGE_BUCKET` | 对象存储桶 | `studio-assets` |
| `STUDIO_S3_ENDPOINT` | S3 兼容对象存储地址 | `http://localhost:9000` |
| `STUDIO_S3_REGION` | S3 区域 | `auto` |
| `STUDIO_S3_ACCESS_KEY_ID` | S3 Access Key | `studio` |
| `STUDIO_S3_SECRET_ACCESS_KEY` | S3 Secret Key | `studio-secret` |
| `PORT` | API 端口 | `4000` |

生成本地加密密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 数据库迁移

```bash
export DATABASE_URL=postgres://studio:studio@localhost:5432/studio
pnpm --filter studio-api db:migrate
```

迁移文件位于 `apps/studio-api/src/db/migrations`。重复执行会跳过已存在的类型、表和索引。

## 对象存储

本地开发可保留 `STUDIO_STORAGE_MODE=local`，API 会使用内存存储完成上传闭环。需要验证预签名直传时，改用 MinIO：

```bash
export STUDIO_STORAGE_MODE=s3
export STUDIO_S3_ENDPOINT=http://localhost:9000
export STUDIO_S3_ACCESS_KEY_ID=studio
export STUDIO_S3_SECRET_ACCESS_KEY=studio-secret
```

`docker compose up -d` 会启动 MinIO，并创建 `studio-assets` 桶。

## API 密钥

开发者不需要在环境变量中写入即梦密钥。打开 Web 工作台的 API 设置页，保存 API Key 和 Secret Key。API 会加密保存 Secret Key，只向前端返回脱敏标签。

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter studio-web e2e
```

独立启动命令：

```bash
pnpm start:api
pnpm start:worker
pnpm start:web
```

## 部署

完整部署步骤见 [docs/deployment.md](docs/deployment.md)。

1. 在部署环境安装 Node.js 22、pnpm 9.15、PostgreSQL 客户端。
2. 提供 PostgreSQL、Redis 和 S3 兼容对象存储。
3. 设置 `.env` 中的环境变量，使用长期保存的 `STUDIO_SECRET_KEY_BASE64`。
4. 运行 `pnpm install --frozen-lockfile`。
5. 运行 `pnpm --filter studio-api db:migrate`。
6. 运行 `pnpm build`。
7. 分别启动 API、Worker 和 Web 预览服务。

## 常见错误

| 现象 | 处理方式 |
| --- | --- |
| API 报 `STUDIO_SECRET_KEY_BASE64 必须是 32 字节 Base64 密钥` | 重新生成 32 字节 Base64 密钥，并保持后续部署不变。 |
| `psql: command not found` | 安装 PostgreSQL 客户端，或在带 `psql` 的容器中运行迁移。 |
| Worker 没有消费任务 | 检查 `REDIS_URL`，确认 API 和 Worker 指向同一个 Redis。 |
| S3 上传失败 | 检查桶名、Endpoint、Access Key 和 Secret Key。MinIO 本地桶名是 `studio-assets`。 |
| Web 调不到 API | 开发环境检查 Vite 代理和 API 端口，部署环境检查反向代理是否转发 `/api`。 |

## 工作区结构

```text
apps/studio-web             工作台界面
apps/studio-api             任务 API、数据 schema、凭证加密
apps/studio-worker          生成任务 Worker
packages/shared             前后端共享 Zod 契约
packages/provider-jimeng    即梦 Provider 适配层
```

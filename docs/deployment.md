# 影栈 Studio 部署文档

## 部署前检查

- 安装 Node.js 22 和 pnpm 9.15。
- 准备 PostgreSQL、Redis 和 S3 兼容对象存储。
- 安装 PostgreSQL 客户端 `psql`。
- 生成并保存 `STUDIO_SECRET_KEY_BASE64`。更换该密钥会导致旧凭证无法解密。

## 环境变量

```bash
DATABASE_URL=postgres://studio:studio@localhost:5432/studio
REDIS_URL=redis://localhost:6379
STUDIO_SECRET_KEY_BASE64=replace-with-32-byte-base64-key
STUDIO_STORAGE_MODE=s3
STUDIO_STORAGE_BUCKET=studio-assets
STUDIO_S3_ENDPOINT=http://localhost:9000
STUDIO_S3_REGION=auto
STUDIO_S3_ACCESS_KEY_ID=studio
STUDIO_S3_SECRET_ACCESS_KEY=studio-secret
PORT=4000
```

本地验证可使用 `STUDIO_STORAGE_MODE=local`。共享环境必须使用 `s3`，并给对象存储账号授予目标桶读写权限。

## Docker Compose

```bash
docker compose up -d
docker compose ps
```

Compose 会启动 PostgreSQL、Redis、MinIO，并创建 `studio-assets` 桶。MinIO 控制台地址是 `http://localhost:9001`，账号 `studio`，密码 `studio-secret`。

## 数据库迁移

```bash
export DATABASE_URL=postgres://studio:studio@localhost:5432/studio
pnpm --filter studio-api db:migrate
```

迁移文件位于 `apps/studio-api/src/db/migrations`。迁移使用 `IF NOT EXISTS`，重复执行不会重建已有对象。

## 启动服务

开发环境：

```bash
pnpm dev
```

拆分启动：

```bash
pnpm start:api
pnpm start:worker
pnpm start:web
```

Web 默认使用 `4173` 端口预览构建结果。API 默认监听 `4000`。Worker 使用 `REDIS_URL` 连接同一个队列。

## API 密钥

不要把即梦 Secret Key 写入前端配置。用户在 Web 的 API 设置页保存 API Key 和 Secret Key。API 使用 `STUDIO_SECRET_KEY_BASE64` 加密 Secret Key，并只返回脱敏标签。

## 验证命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter studio-web e2e
```

## 常见错误

| 现象 | 处理方式 |
| --- | --- |
| `STUDIO_SECRET_KEY_BASE64 必须是 32 字节 Base64 密钥` | 重新生成 32 字节 Base64 密钥，更新环境变量后重启 API。 |
| `psql: command not found` | 安装 PostgreSQL 客户端，或在带 `psql` 的容器中运行迁移。 |
| Worker 不处理任务 | 检查 `REDIS_URL`，确认 API 和 Worker 使用同一个 Redis。 |
| S3 上传返回 403 | 检查桶权限、Access Key、Secret Key 和 Endpoint。 |
| Web 请求 API 失败 | 检查 `/api` 反向代理，确认 API 监听端口可访问。 |

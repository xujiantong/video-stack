# 影栈 Studio

影栈 Studio 是视频生成工作台 MVP。当前版本支持工作区初始化、共享契约、API 任务接口、Worker 处理流程、即梦 Provider 适配层和深色工作台界面。

## 本地启动

```bash
pnpm install
docker compose up -d
pnpm dev
```

Web 默认运行在 Vite 输出的本地地址。API 默认端口为 `4000`。

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter studio-web e2e
```

## 工作区结构

```text
apps/studio-web      工作台界面
apps/studio-api      任务 API、数据 schema、凭证加密
apps/studio-worker   生成任务 Worker
packages/shared      前后端共享 Zod 契约
packages/provider-jimeng 即梦 Provider 适配层
```

module.exports = {
  apps: [
    {
      name: "video-stack-api",
      script: "pnpm",
      args: "--filter studio-api start",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10
    },
    {
      name: "video-stack-worker",
      script: "pnpm",
      args: "--filter studio-worker start",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10
    },
    {
      name: "video-stack-web",
      script: "pnpm",
      args: "--filter studio-web start",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10
    }
  ]
};

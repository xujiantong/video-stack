import { Button } from "@/components/ui/button";

export function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-sm rounded-md border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">影栈 Studio</p>
        <h1 className="mt-2 text-xl font-semibold">登录影栈 Studio</h1>
        <p className="mt-2 text-sm text-muted-foreground">使用官方 API 成本运行的视频生成工作台。</p>
        <div className="mt-5 grid gap-3">
          <input className="h-10 rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary" placeholder="邮箱" />
          <input className="h-10 rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary" placeholder="密码" type="password" />
          <Button type="button">登录</Button>
        </div>
      </section>
    </div>
  );
}

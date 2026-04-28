import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-sm rounded-popover border border-border bg-surface p-5 shadow-popover">
        <p className="text-xs uppercase text-muted-foreground">影栈 Studio</p>
        <h1 className="mt-2 text-xl font-semibold">登录影栈 Studio</h1>
        <p className="mt-2 text-sm text-muted-foreground">使用官方 API 成本运行的视频生成工作台。</p>
        <div className="mt-5 grid gap-3">
          <Input placeholder="邮箱" />
          <Input placeholder="密码" type="password" />
          <Button type="button">登录</Button>
        </div>
      </section>
    </div>
  );
}

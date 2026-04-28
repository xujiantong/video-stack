import { type FormEvent, useState } from "react";
import { AlertCircle, KeyRound, LoaderCircle, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LoginMode = "password" | "api-key";
type SubmitState = "idle" | "submitting" | "failed";

const initialApiForm = {
  apiKey: "",
  secretKey: "",
  serviceRegion: "cn-north-1",
  defaultModel: "jimeng-video-v3"
};

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("password");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [apiForm, setApiForm] = useState(initialApiForm);
  const isSubmitting = submitState === "submitting";

  function showFailure(next: () => void) {
    setSubmitState("submitting");
    window.setTimeout(next, 600);
  }

  function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    showFailure(() => {
      setPassword("");
      setSubmitState("failed");
    });
  }

  function handleApiKeyLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    showFailure(() => {
      setApiForm((current) => ({ ...current, secretKey: "" }));
      setSubmitState("failed");
    });
  }

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setSubmitState("idle");
  }

  function updateApiField(field: keyof typeof initialApiForm, value: string) {
    setApiForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-hidden rounded-composer border border-border bg-surface shadow-popover md:min-h-[calc(100vh-4rem)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="border-b border-border bg-card p-6 md:border-b-0 md:border-r md:p-8">
          <div className="grid size-11 place-items-center rounded-card border border-primary/30 bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-medium uppercase text-muted-foreground">影栈 Studio</p>
          <h1 className="mt-2 text-2xl font-semibold">登录影栈 Studio</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">进入工作台，管理素材、生成任务和 API 凭证。</p>
          <dl className="mt-8 grid gap-4 text-sm">
            <div className="rounded-card border border-border bg-muted p-3">
              <dt className="font-medium text-foreground">内部账号</dt>
              <dd className="mt-1 text-muted-foreground">使用邮箱和密码登录。</dd>
            </div>
            <div className="rounded-card border border-border bg-muted p-3">
              <dt className="font-medium text-foreground">API Key 登录</dt>
              <dd className="mt-1 text-muted-foreground">只在本次会话使用 Secret Key。</dd>
            </div>
          </dl>
        </aside>

        <div className="flex items-center p-5 md:p-8">
          <div className="w-full">
            <div className="flex rounded-button border border-border bg-background p-1" role="tablist" aria-label="登录方式">
              <button
                aria-selected={mode === "password"}
                className={cn(
                  "flex-1 rounded-button px-3 py-2 text-sm transition",
                  mode === "password" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                role="tab"
                type="button"
                onClick={() => selectMode("password")}
              >
                邮箱登录
              </button>
              <button
                aria-selected={mode === "api-key"}
                className={cn(
                  "flex-1 rounded-button px-3 py-2 text-sm transition",
                  mode === "api-key" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                role="tab"
                type="button"
                onClick={() => selectMode("api-key")}
              >
                使用 API Key 登录
              </button>
            </div>

            {mode === "password" ? (
              <form className="mt-5 grid gap-4" onSubmit={handlePasswordLogin}>
                <label className="grid gap-2 text-sm">
                  <span className="text-muted-foreground">邮箱</span>
                  <span className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      className="pl-9"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-muted-foreground">密码</span>
                  <span className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      className="pl-9"
                      autoComplete="current-password"
                      placeholder="输入密码"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    checked={rememberMe}
                    className="size-4 rounded border-border bg-input accent-primary"
                    type="checkbox"
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  记住我
                </label>
                {submitState === "failed" ? (
                  <p role="alert" className="flex items-start gap-2 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-foreground">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                    <span>登录失败，请检查邮箱和密码。请重新输入密码。</span>
                  </p>
                ) : null}
                <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {isSubmitting ? "登录中..." : "登录"}
                </Button>
              </form>
            ) : (
              <form className="mt-5 grid gap-4" onSubmit={handleApiKeyLogin}>
                <label className="grid gap-2 text-sm">
                  <span className="text-muted-foreground">API Key</span>
                  <Input
                    autoComplete="off"
                    placeholder="输入 API Key"
                    value={apiForm.apiKey}
                    onChange={(event) => updateApiField("apiKey", event.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-muted-foreground">Secret Key</span>
                  <Input
                    autoComplete="off"
                    placeholder="提交后清空"
                    type="password"
                    value={apiForm.secretKey}
                    onChange={(event) => updateApiField("secretKey", event.target.value)}
                    required
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">服务区域</span>
                    <Input autoComplete="off" value={apiForm.serviceRegion} onChange={(event) => updateApiField("serviceRegion", event.target.value)} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">默认模型</span>
                    <Input autoComplete="off" value={apiForm.defaultModel} onChange={(event) => updateApiField("defaultModel", event.target.value)} />
                  </label>
                </div>
                {submitState === "failed" ? (
                  <p role="alert" className="flex items-start gap-2 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-foreground">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                    <span>API Key 登录失败，请检查 Key 和服务区域。请重新输入 Secret Key。</span>
                  </p>
                ) : null}
                <Button aria-label={isSubmitting ? "登录中..." : "验证并登录"} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
                  {isSubmitting ? "登录中..." : "验证并登录"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

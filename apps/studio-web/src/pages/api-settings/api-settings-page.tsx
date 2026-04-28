import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApiSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl p-4 pb-28">
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-card bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">API 配置</h2>
            <p className="text-sm text-muted-foreground">前端不保存 Secret Key，密钥提交后由后端加密保存。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          {["API Key", "Secret Key", "服务区域", "默认模型"].map((label) => (
            <label className="grid gap-2 text-sm" key={label}>
              <span className="text-muted-foreground">{label}</span>
              <Input placeholder={`请输入${label}`} type={label.includes("Secret") ? "password" : "text"} />
            </label>
          ))}
          <Button className="w-fit" type="button">
            保存并检测连接
          </Button>
        </div>
      </section>
    </div>
  );
}

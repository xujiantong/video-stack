import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Trash2, Wifi } from "lucide-react";
import type { CreateCredentialRequest } from "@video-stack/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCredential, listCredentials, saveCredential, testCredential } from "@/lib/api/credentials-api";

const credentialsQueryKey = ["provider-credentials"] as const;

type CredentialFormState = {
  apiKey: string;
  defaultModelId: string;
  displayName: string;
  secretKey: string;
  serviceRegion: string;
};

type SettingsMessage = {
  tone: "status" | "error";
  text: string;
};

const initialFormState: CredentialFormState = {
  apiKey: "",
  defaultModelId: "",
  displayName: "即梦主账号",
  secretKey: "",
  serviceRegion: ""
};

export function ApiSettingsPage() {
  const [form, setForm] = useState<CredentialFormState>(initialFormState);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const queryClient = useQueryClient();
  const credentialsQuery = useQuery({
    queryKey: credentialsQueryKey,
    queryFn: listCredentials
  });
  const activeCredential = credentialsQuery.data?.[0] ?? null;

  const saveMutation = useMutation({
    mutationFn: saveCredential,
    async onSuccess() {
      setForm(initialFormState);
      setMessage({ tone: "status", text: "凭证已保存。前端已清空 API Key 和 Secret Key。" });
      await queryClient.invalidateQueries({ queryKey: credentialsQueryKey });
    },
    onError(error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "保存凭证失败，请检查字段后重试。" });
    }
  });
  const testMutation = useMutation({
    mutationFn: testCredential,
    onSuccess(result) {
      setMessage({ tone: result.ok ? "status" : "error", text: result.message });
    },
    onError(error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "检测凭证失败，请重新保存后再试。" });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCredential,
    async onSuccess() {
      setMessage({ tone: "status", text: "凭证已删除，请重新保存后再生成视频。" });
      await queryClient.invalidateQueries({ queryKey: credentialsQueryKey });
    },
    onError(error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "删除凭证失败，请刷新后重试。" });
    }
  });

  function updateField(field: keyof CredentialFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    setMessage(null);
    const payload: CreateCredentialRequest = {
      provider: "jimeng",
      displayName: form.displayName.trim(),
      secretKey: form.secretKey
    };
    const apiKey = form.apiKey.trim();
    const serviceRegion = form.serviceRegion.trim();
    const defaultModelId = form.defaultModelId.trim();
    if (apiKey) payload.apiKey = apiKey;
    if (serviceRegion) payload.serviceRegion = serviceRegion;
    if (defaultModelId) payload.defaultModelId = defaultModelId;
    saveMutation.mutate(payload);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-28">
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-card bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">API 配置</h2>
            <p className="text-sm text-muted-foreground">前端不保存 Secret Key，提交后由后端加密保存。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="text-muted-foreground">显示名称</span>
            <Input value={form.displayName} placeholder="即梦主账号" onChange={(event) => updateField("displayName", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-muted-foreground">API Key</span>
            <Input value={form.apiKey} placeholder="提交后前端会清空" onChange={(event) => updateField("apiKey", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-muted-foreground">Secret Key</span>
            <Input
              value={form.secretKey}
              placeholder="提交后不再明文展示"
              type="password"
              onChange={(event) => updateField("secretKey", event.target.value)}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">服务区域</span>
              <Input value={form.serviceRegion} placeholder="可选" onChange={(event) => updateField("serviceRegion", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">默认模型</span>
              <Input value={form.defaultModelId} placeholder="可选" onChange={(event) => updateField("defaultModelId", event.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleSave} disabled={form.displayName.trim().length === 0 || form.secretKey.length < 8 || saveMutation.isPending}>
              保存凭证
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => activeCredential && testMutation.mutate(activeCredential.id)}
              disabled={!activeCredential || testMutation.isPending}
            >
              <Wifi className="size-4" aria-hidden="true" />
              检测连接
            </Button>
          </div>
          {message ? (
            <p
              className={`rounded-card border p-3 text-sm ${
                message.tone === "error" ? "border-danger/40 bg-danger/10 text-foreground" : "border-border bg-muted text-foreground"
              }`}
              role={message.tone === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">已保存凭证</h2>
            <p className="text-sm text-muted-foreground">列表只显示脱敏信息。</p>
          </div>
          {credentialsQuery.isFetching ? <Badge>同步中</Badge> : null}
        </div>
        <div className="mt-4 space-y-3">
          {credentialsQuery.data?.length ? (
            credentialsQuery.data.map((credential) => (
              <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-muted p-3" key={credential.id}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{credential.displayName}</p>
                    <Badge tone="success">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      已保存
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{credential.maskedLabel}</p>
                </div>
                <Button
                  aria-label="删除凭证"
                  className="size-9 px-0 text-danger"
                  type="button"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(credential.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))
          ) : (
            <p className="rounded-card border border-border bg-muted p-3 text-sm text-muted-foreground" role="status">
              暂无凭证，请先保存 API Key 和 Secret Key。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

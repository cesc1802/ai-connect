import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import {
  PROVIDER_CATALOG,
  catalogByKey,
  type Provider,
  type ProviderScope,
} from "@/lib/mock-data";
import {
  checkProviderConnection,
  type CheckConnectionBody,
} from "@/lib/providers-api";

export type ProviderFormValues = {
  providerKey: string;
  host: string;
  key: string;
  keyLabel: string;
  model: string;
  scope: ProviderScope;
};

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; latencyMs: number }
  | { kind: "fail"; reason: string };

type Props = {
  mode: "create" | "edit";
  initial?: Provider | null;
  onSubmit: (v: ProviderFormValues) => void;
  footer?: (ctx: { canSubmit: boolean }) => ReactNode;
};

// Shared form used by both the Create and Edit provider screens. Self-contained:
// owns provider catalog selection, live connection check, and validation.
export function ProviderForm({ mode, initial, onSubmit, footer }: Props) {
  const [providerKey, setProviderKey] = useState<string>(
    initial?.providerKey ?? PROVIDER_CATALOG[0].key,
  );
  const catalog = useMemo(() => catalogByKey(providerKey), [providerKey]);
  const isLocal = catalog?.type === "local";

  const [host, setHost] = useState<string>(initial?.host ?? catalog?.host ?? "");
  const [keyLabel, setKeyLabel] = useState<string>(
    initial?.keyLabel ?? (catalog?.type === "local" ? "local" : "key1"),
  );
  const [secret, setSecret] = useState<string>("");
  const [rotating, setRotating] = useState<boolean>(mode === "create");
  const [model, setModel] = useState<string>(initial?.model ?? catalog?.models[0] ?? "");
  const [scope, setScope] = useState<ProviderScope>(initial?.scope ?? "org");
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });

  // Snap host/model to catalog defaults whenever the provider type changes (create flow only).
  useEffect(() => {
    if (mode === "edit") return;
    if (!catalog) return;
    setHost(catalog.host);
    setModel((prev) => (catalog.models.includes(prev) ? prev : catalog.models[0] ?? ""));
    setSecret("");
    setCheck({ kind: "idle" });
  }, [catalog, mode]);

  const needsKey = !isLocal;
  const haveSecret = isLocal || !rotating || secret.trim().length >= 4;
  const canTest = !!catalog && host.trim().length > 0 && (!needsKey || rotating ? haveSecret : true);
  const canSubmit = !!catalog && !!model && host.trim().length > 0 && (mode === "edit" || haveSecret);

  async function runCheck() {
    if (!canTest) return;
    setCheck({ kind: "checking" });
    try {
      // Edit mode without a new key: check the stored provider (server
      // decrypts its own key). Otherwise check the in-form credentials.
      const useStored = mode === "edit" && initial && secret.trim().length === 0;
      const result = await checkProviderConnection(
        useStored
          ? { providerId: initial.id, baseUrl: host.trim() || undefined }
          : {
              providerKind: providerKey as CheckConnectionBody["providerKind"],
              baseUrl: host.trim() || undefined,
              apiKey: secret.trim() || undefined,
            },
      );
      setCheck(result.ok
        ? { kind: "ok", latencyMs: result.latencyMs }
        : { kind: "fail", reason: result.reason });
    } catch (err) {
      setCheck({ kind: "fail", reason: err instanceof Error ? err.message : "Kiểm tra thất bại" });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !catalog) return;
    onSubmit({
      providerKey: catalog.key,
      host: host.trim(),
      key: secret.trim(),
      keyLabel: keyLabel.trim() || (isLocal ? "local" : "key"),
      model,
      scope,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <ProviderSelect value={providerKey} onChange={setProviderKey} disabled={mode === "edit"} />
      <HostField value={host} onChange={setHost} isLocal={isLocal} hasPicked={!!catalog} />
      {!isLocal && (
        <KeyField
          mode={mode}
          rotating={rotating}
          onRotateToggle={setRotating}
          value={secret}
          onChange={setSecret}
          masked={initial?.masked ?? ""}
          placeholder={catalog?.keyHint}
          docs={catalog?.docs}
        />
      )}
      <KeyLabelField value={keyLabel} onChange={setKeyLabel} />
      <ModelField value={model} onChange={setModel} options={catalog?.models ?? []} hasPicked={!!catalog} />
      <ScopeField value={scope} onChange={setScope} />
      <CheckRow state={check} canTest={canTest} onTest={runCheck} model={model} />
      {footer?.({ canSubmit })}
    </form>
  );
}

function ProviderSelect({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const cur = catalogByKey(value);
  return (
    <Field label="Nhà cung cấp">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon name={cur?.icon ?? "package"} className="h-3.5 w-3.5" />
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-full appearance-none rounded-md border bg-background pl-11 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1 disabled:opacity-60"
        >
          {PROVIDER_CATALOG.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.name}{opt.type === "local" ? " · local" : ""}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </Field>
  );
}

function HostField({
  value, onChange, isLocal, hasPicked,
}: { value: string; onChange: (v: string) => void; isLocal: boolean; hasPicked: boolean }) {
  return (
    <Field
      label="Host / Endpoint"
      hint={hasPicked
        ? (isLocal ? "Endpoint nội bộ — không rời máy chủ." : "Mặc định theo nhà cung cấp; chỉnh nếu dùng proxy/gateway riêng.")
        : undefined}
    >
      <div className="relative">
        <Icon name="globe" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://api.example.com/v1"
          disabled={!hasPicked}
          className="pl-9 font-mono text-xs"
        />
      </div>
    </Field>
  );
}

function KeyField({
  mode, rotating, onRotateToggle, value, onChange, masked, placeholder, docs,
}: {
  mode: "create" | "edit";
  rotating: boolean;
  onRotateToggle: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
  masked: string;
  placeholder?: string;
  docs?: string;
}) {
  const showRotateBtn = mode === "edit";
  return (
    <Field
      label="API Key"
      action={showRotateBtn ? (
        rotating
          ? <button type="button" onClick={() => { onRotateToggle(false); onChange(""); }} className="text-2xs font-medium text-muted-foreground hover:underline">Huỷ đổi</button>
          : <button type="button" onClick={() => onRotateToggle(true)} className="text-2xs font-medium text-primary hover:underline">Đổi khoá</button>
      ) : null}
      hint={
        <span className="flex items-center gap-1">
          <Icon name="shield-check" className="h-3 w-3" />
          {rotating
            ? <>Mã hoá AES-256-GCM. {docs && <>Lấy tại <span className="font-medium">{docs}</span></>}</>
            : <>Đã mã hoá · không thể xem toàn bộ.</>}
        </span>
      }
    >
      <div className="relative">
        <Icon name="key-round" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        {rotating ? (
          <Input
            type="password"
            autoFocus={mode === "edit"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "sk-••••••••••••••••"}
            className="pl-9 font-mono text-xs"
          />
        ) : (
          <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 pl-9 pr-3 font-mono text-xs text-muted-foreground shadow-xs">
            {masked || "•".repeat(20)}
          </div>
        )}
      </div>
    </Field>
  );
}

function KeyLabelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Nhãn key" hint="Hiển thị bên cạnh tên provider để phân biệt nhiều khoá.">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="VD: key1, prod, local" />
    </Field>
  );
}

function ModelField({
  value, onChange, options, hasPicked,
}: { value: string; onChange: (v: string) => void; options: string[]; hasPicked: boolean }) {
  return (
    <Field label="Model mặc định">
      <div className="relative">
        <Icon name="bot" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!hasPicked || options.length === 0}
          className="h-9 w-full appearance-none rounded-md border bg-background pl-9 pr-8 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1 disabled:opacity-60"
        >
          {options.length === 0 && <option value="">Chọn nhà cung cấp trước</option>}
          {options.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </Field>
  );
}

const SCOPE_OPTIONS: { value: ProviderScope; icon: string; title: string; sub: string }[] = [
  { value: "org", icon: "building", title: "Toàn tổ chức", sub: "Mọi workspace dùng chung" },
  { value: "select", icon: "layers", title: "Chọn workspace", sub: "Chỉ workspace được gán" },
];

function ScopeField({ value, onChange }: { value: ProviderScope; onChange: (v: ProviderScope) => void }) {
  return (
    <Field label="Phạm vi">
      <div className="grid grid-cols-2 gap-2">
        {SCOPE_OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                active ? "border-primary/40 bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <Icon name={o.icon} className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0">
                <div className="text-xs font-medium">{o.title}</div>
                <div className="text-2xs text-muted-foreground">{o.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function CheckRow({
  state, canTest, onTest, model,
}: { state: CheckState; canTest: boolean; onTest: () => void; model: string }) {
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={onTest}
        disabled={!canTest || state.kind === "checking"}
        className={cn(
          "w-full justify-center",
          state.kind === "ok" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15",
        )}
      >
        {state.kind === "idle" && <><Icon name="circle-check" className="h-4 w-4" /> Kiểm tra kết nối</>}
        {state.kind === "checking" && <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Đang kiểm tra…</>}
        {state.kind === "ok" && <><Icon name="circle-check" className="h-4 w-4" /> Kết nối thành công · {state.latencyMs}ms{model ? ` · ${model}` : ""}</>}
        {state.kind === "fail" && <><Icon name="info" className="h-4 w-4" /> {state.reason}</>}
      </Button>
      {state.kind !== "ok" && (
        <p className="text-center text-2xs text-muted-foreground">
          Khuyến nghị kiểm tra kết nối trước khi lưu.
        </p>
      )}
    </div>
  );
}

function Field({
  label, hint, action, children,
}: { label: string; hint?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {action}
      </div>
      {children}
      {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

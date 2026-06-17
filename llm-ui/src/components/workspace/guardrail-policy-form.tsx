import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "./toggle-switch";
import type {
  GuardrailPolicy,
  GuardrailCheckConfig,
  GuardrailKind,
  GuardrailAction,
} from "@/lib/guardrails-api";

// MVP editor: master toggle + per-check enable/action + blocklist terms.
// Granular per-detector/category editors are deferred follow-ups; the policy
// JSON already round-trips their options via the API.

const KINDS: GuardrailKind[] = ["pii", "blocklist", "injection", "moderation"];

const KIND_LABEL: Record<GuardrailKind, string> = {
  pii: "Thông tin nhạy cảm (PII)",
  blocklist: "Danh sách chặn",
  injection: "Prompt injection",
  moderation: "Kiểm duyệt nội dung",
};

const DEFAULT_ACTION: Record<GuardrailKind, GuardrailAction> = {
  pii: "redact",
  blocklist: "block",
  injection: "block",
  moderation: "block",
};

// Classification checks can only block or warn — there is no span to redact.
const ACTIONS_FOR: Record<GuardrailKind, GuardrailAction[]> = {
  pii: ["redact", "block", "warn"],
  blocklist: ["redact", "block", "warn"],
  injection: ["block", "warn"],
  moderation: ["block", "warn"],
};

const ACTION_LABEL: Record<GuardrailAction, string> = {
  redact: "Che (redact)",
  block: "Chặn (block)",
  warn: "Cảnh báo (warn)",
};

// Render all four checks, falling back to a disabled default for any the stored
// policy omits, so the screen always shows the full set.
function mergeChecks(policy: GuardrailPolicy): GuardrailCheckConfig[] {
  return KINDS.map((kind) => {
    const stored = policy.checks.find((c) => c.kind === kind);
    return stored ?? { kind, enabled: false, action: DEFAULT_ACTION[kind] };
  });
}

function termsOf(check: GuardrailCheckConfig): string {
  const terms = (check.options?.["terms"] as unknown[] | undefined) ?? [];
  return terms.filter((t): t is string => typeof t === "string").join("\n");
}

type Props = {
  initial: GuardrailPolicy;
  saving: boolean;
  onSave: (policy: GuardrailPolicy) => void;
};

export function GuardrailPolicyForm({ initial, saving, onSave }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [checks, setChecks] = useState<GuardrailCheckConfig[]>(() => mergeChecks(initial));

  const update = (kind: GuardrailKind, patch: Partial<GuardrailCheckConfig>) =>
    setChecks((cur) => cur.map((c) => (c.kind === kind ? { ...c, ...patch } : c)));

  const setTerms = (raw: string) => {
    const terms = raw.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
    const existing = checks.find((c) => c.kind === "blocklist")?.options ?? {};
    update("blocklist", { options: { ...existing, terms } });
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Bật guardrails cho workspace</div>
          <p className="text-xs text-muted-foreground">
            Kiểm tra nội dung trước khi gửi tới mô hình.
          </p>
        </div>
        <ToggleSwitch checked={enabled} label="Bật guardrails" onChange={setEnabled} />
      </div>

      <div className={enabled ? "space-y-3" : "pointer-events-none space-y-3 opacity-50"}>
        {checks.map((c) => (
          <div key={c.kind} className="space-y-2 rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{KIND_LABEL[c.kind]}</span>
              <ToggleSwitch
                checked={c.enabled}
                label={`Bật ${KIND_LABEL[c.kind]}`}
                onChange={(next) => update(c.kind, { enabled: next })}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Hành động</label>
              <select
                aria-label={`Hành động cho ${KIND_LABEL[c.kind]}`}
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={c.action}
                onChange={(e) => update(c.kind, { action: e.target.value as GuardrailAction })}
              >
                {ACTIONS_FOR[c.kind].map((a) => (
                  <option key={a} value={a}>{ACTION_LABEL[a]}</option>
                ))}
              </select>
            </div>
            {c.kind === "blocklist" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Từ khoá chặn (mỗi dòng hoặc phân tách bằng dấu phẩy)
                </label>
                <textarea
                  aria-label="Từ khoá chặn"
                  className="min-h-[64px] w-full rounded-md border bg-background p-2 text-sm"
                  defaultValue={termsOf(c)}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="vd: launchcode, mật khẩu nội bộ"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onSave({ enabled, checks })} disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu cấu hình"}
        </Button>
      </div>
    </div>
  );
}

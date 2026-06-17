import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getGuardrailPolicy,
  saveGuardrailPolicy,
  type GuardrailPolicy,
} from "@/lib/guardrails-api";
import { GuardrailPolicyForm } from "./guardrail-policy-form";

// Loads the workspace guardrail policy and persists edits via PUT. Editing the
// policy is admin-gated server-side; non-admins simply get a 403 on save.

type Props = { workspaceId: string };

export function GuardrailsTab({ workspaceId }: Props) {
  const [policy, setPolicy] = useState<GuardrailPolicy | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setPolicy(null);
    setSaved(false);
    getGuardrailPolicy(workspaceId)
      .then((p) => { if (!cancelled) setPolicy(p); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [workspaceId, reload]);

  const save = async (next: GuardrailPolicy) => {
    setSaving(true);
    setSaved(false);
    try {
      const stored = await saveGuardrailPolicy(workspaceId, next);
      setPolicy(stored);
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <p className="text-sm font-medium text-destructive">Không tải được cấu hình guardrails.</p>
        <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>Thử lại</Button>
      </div>
    );
  }

  if (policy === null) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Đang tải cấu hình guardrails…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {saved && <p className="text-xs font-medium text-emerald-600">Đã lưu cấu hình.</p>}
      <GuardrailPolicyForm
        key={`${workspaceId}-${reload}`}
        initial={policy}
        saving={saving}
        onSave={(p) => void save(p)}
      />
    </div>
  );
}

/* @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuardrailPolicyForm } from "../guardrail-policy-form";
import type { GuardrailPolicy } from "@/lib/guardrails-api";

const EMPTY_POLICY: GuardrailPolicy = { enabled: true, checks: [] };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(policy: GuardrailPolicy, onSave = vi.fn()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<GuardrailPolicyForm initial={policy} saving={false} onSave={onSave} />);
  });
  return { onSave };
}

function selectFor(label: string): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>(`select[aria-label="Hành động cho ${label}"]`);
  if (!el) throw new Error(`select not found: ${label}`);
  return el;
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("GuardrailPolicyForm", () => {
  it("renders a card with an action select for all four checks", () => {
    render(EMPTY_POLICY);
    expect(container.querySelectorAll("select")).toHaveLength(4);
  });

  it("hides the redact action for injection and moderation only", () => {
    render(EMPTY_POLICY);
    const optsOf = (s: HTMLSelectElement) => Array.from(s.options).map((o) => o.value);

    expect(optsOf(selectFor("Thông tin nhạy cảm (PII)"))).toContain("redact");
    expect(optsOf(selectFor("Danh sách chặn"))).toContain("redact");
    expect(optsOf(selectFor("Prompt injection"))).not.toContain("redact");
    expect(optsOf(selectFor("Kiểm duyệt nội dung"))).not.toContain("redact");
  });

  it("greys out and disables the checks when the master toggle is off", () => {
    render({ enabled: false, checks: [] });
    const grid = container.querySelector(".opacity-50");
    expect(grid).not.toBeNull();
    expect(grid?.className).toContain("pointer-events-none");
  });

  it("hydrates per-check state from the fetched policy", () => {
    render({
      enabled: true,
      checks: [{ kind: "blocklist", enabled: true, action: "warn", options: { terms: ["alpha", "beta"] } }],
    });
    expect(selectFor("Danh sách chặn").value).toBe("warn");
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Từ khoá chặn"]');
    expect(textarea?.value).toBe("alpha\nbeta");
  });

  it("emits the full four-check policy on save", () => {
    const { onSave } = render(EMPTY_POLICY);
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Lưu cấu hình"),
    );
    act(() => {
      saveBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0]![0] as GuardrailPolicy;
    expect(payload.enabled).toBe(true);
    expect(payload.checks.map((c) => c.kind)).toEqual(["pii", "blocklist", "injection", "moderation"]);
  });
});

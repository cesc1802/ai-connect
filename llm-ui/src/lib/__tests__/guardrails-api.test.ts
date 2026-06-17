import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";
import {
  getGuardrailPolicy,
  saveGuardrailPolicy,
  type GuardrailPolicy,
} from "../guardrails-api";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const WS_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const POLICY: GuardrailPolicy = {
  enabled: true,
  checks: [{ kind: "pii", enabled: true, action: "redact" }],
};

describe("guardrails-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getGuardrailPolicy issues GET /workspaces/:id/guardrails", async () => {
    vi.mocked(api.get).mockResolvedValue(POLICY);

    await expect(getGuardrailPolicy(WS_ID)).resolves.toEqual(POLICY);
    expect(api.get).toHaveBeenCalledWith(`/workspaces/${WS_ID}/guardrails`);
  });

  it("saveGuardrailPolicy PUTs the policy and returns the stored shape", async () => {
    vi.mocked(api.put).mockResolvedValue(POLICY);

    await expect(saveGuardrailPolicy(WS_ID, POLICY)).resolves.toEqual(POLICY);
    expect(api.put).toHaveBeenCalledWith(`/workspaces/${WS_ID}/guardrails`, POLICY);
  });

  it("url-encodes the workspace id", async () => {
    vi.mocked(api.get).mockResolvedValue(POLICY);

    await getGuardrailPolicy("a b/c");
    expect(api.get).toHaveBeenCalledWith("/workspaces/a%20b%2Fc/guardrails");
  });
});

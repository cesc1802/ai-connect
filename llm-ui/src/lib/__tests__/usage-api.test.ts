import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";
import { getUsage, type UsageResponse } from "../usage-api";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const RESPONSE: UsageResponse = {
  byProvider: [
    { providerId: "p1", providerKind: "anthropic", inputTokens: 100, outputTokens: 40, totalTokens: 140, requestCount: 2 },
  ],
  byWorkspace: [
    { workspaceId: "ws-1", slug: "alpha", name: "Alpha", inputTokens: 100, outputTokens: 40, totalTokens: 140, requestCount: 2 },
  ],
};

describe("usage-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUsage fetches GET /api/dashboard/usage and returns the parsed body", async () => {
    vi.mocked(api.get).mockResolvedValue(RESPONSE);

    await expect(getUsage()).resolves.toEqual(RESPONSE);
    expect(api.get).toHaveBeenCalledWith("/api/dashboard/usage");
  });
});

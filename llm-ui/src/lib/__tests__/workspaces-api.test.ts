import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";
import {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "../workspaces-api";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const WS = {
  id: "6f1f2d3a-4b5c-4d6e-8f90-123456789abc",
  slug: "alpha",
  name: "Alpha",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("workspaces-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listWorkspaces hits GET /workspaces with page and limit", async () => {
    const page = { items: [WS], page: 2, limit: 6, total: 7 };
    vi.mocked(api.get).mockResolvedValue(page);

    await expect(listWorkspaces(2, 6)).resolves.toEqual(page);
    expect(api.get).toHaveBeenCalledWith("/workspaces?page=2&limit=6");
  });

  it("createWorkspace posts name and slug", async () => {
    vi.mocked(api.post).mockResolvedValue(WS);

    await expect(createWorkspace({ name: "Alpha", slug: "alpha" })).resolves.toEqual(WS);
    expect(api.post).toHaveBeenCalledWith("/workspaces", { name: "Alpha", slug: "alpha" });
  });

  it("getWorkspace hits GET /workspaces/:id", async () => {
    vi.mocked(api.get).mockResolvedValue(WS);

    await expect(getWorkspace(WS.id)).resolves.toEqual(WS);
    expect(api.get).toHaveBeenCalledWith(`/workspaces/${WS.id}`);
  });

  it("updateWorkspace patches only the provided fields", async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...WS, name: "Renamed" });

    await updateWorkspace(WS.id, { name: "Renamed" });
    expect(api.patch).toHaveBeenCalledWith(`/workspaces/${WS.id}`, { name: "Renamed" });
  });

  it("deleteWorkspace issues DELETE /workspaces/:id", async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);

    await expect(deleteWorkspace(WS.id)).resolves.toBeUndefined();
    expect(api.del).toHaveBeenCalledWith(`/workspaces/${WS.id}`);
  });
});

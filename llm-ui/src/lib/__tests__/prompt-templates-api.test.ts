import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "../api";
import {
  listTemplateLibrary,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../workspace-templates-api";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const TPL = {
  id: "dddddddd-0000-0000-0000-000000000001",
  slug: "tpl-1",
  title: "Review PR",
  category: "Kỹ thuật",
  icon: "code",
  authorName: "Thược",
  uses: 1240,
  description: "Phân tích diff",
  body: "Bạn là reviewer. {{diff}}",
};

describe("prompt-templates-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listTemplateLibrary unwraps templates from GET /prompt-templates", async () => {
    vi.mocked(api.get).mockResolvedValue({ templates: [TPL] });

    await expect(listTemplateLibrary()).resolves.toEqual([TPL]);
    expect(api.get).toHaveBeenCalledWith("/prompt-templates");
  });

  it("createTemplate posts the input and unwraps the template", async () => {
    vi.mocked(api.post).mockResolvedValue({ template: TPL });
    const input = {
      title: "Review PR",
      category: "Kỹ thuật",
      icon: "code",
      description: "Phân tích diff",
      body: "Bạn là reviewer. {{diff}}",
    };

    await expect(createTemplate(input)).resolves.toEqual(TPL);
    expect(api.post).toHaveBeenCalledWith("/prompt-templates", input);
  });

  it("updateTemplate patches only the provided fields", async () => {
    const renamed = { ...TPL, title: "Đổi tên" };
    vi.mocked(api.patch).mockResolvedValue({ template: renamed });

    await expect(updateTemplate(TPL.id, { title: "Đổi tên" })).resolves.toEqual(renamed);
    expect(api.patch).toHaveBeenCalledWith(`/prompt-templates/${TPL.id}`, { title: "Đổi tên" });
  });

  it("deleteTemplate issues DELETE /prompt-templates/:id", async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);

    await expect(deleteTemplate(TPL.id)).resolves.toBeUndefined();
    expect(api.del).toHaveBeenCalledWith(`/prompt-templates/${TPL.id}`);
  });
});

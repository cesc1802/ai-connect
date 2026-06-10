import { api } from "./api";

// Thin typed wrappers over the org prompt-template library and the
// per-workspace attach list. Attach/detach are admin-only server-side.

export interface PromptTemplate {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: string;
  authorName: string;
  uses: number;
  description: string;
}

export function listAttachedTemplates(workspaceId: string): Promise<PromptTemplate[]> {
  return api
    .get<{ templates: PromptTemplate[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/templates`)
    .then((r) => r.templates);
}

export function listTemplateLibrary(): Promise<PromptTemplate[]> {
  return api.get<{ templates: PromptTemplate[] }>("/prompt-templates").then((r) => r.templates);
}

export function attachTemplate(workspaceId: string, templateId: string): Promise<void> {
  return api
    .post<unknown>(`/workspaces/${encodeURIComponent(workspaceId)}/templates`, { templateId })
    .then(() => undefined);
}

export function detachTemplate(workspaceId: string, templateId: string): Promise<void> {
  return api.del<void>(
    `/workspaces/${encodeURIComponent(workspaceId)}/templates/${encodeURIComponent(templateId)}`,
  );
}

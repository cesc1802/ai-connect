import { api } from "./api";

// Thin typed wrappers over the org prompt-template library and the
// per-workspace attach list. Library mutations and attach/detach are
// admin-only server-side (403 role_required for members).

export interface PromptTemplate {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: string;
  authorName: string;
  uses: number;
  description: string;
  body: string | null;
}

export interface TemplateCreateInput {
  title: string;
  category: string;
  icon: string;
  description: string;
  body?: string;
}

export interface TemplateUpdateInput {
  title?: string;
  category?: string;
  icon?: string;
  description?: string;
  body?: string;
}

export function listAttachedTemplates(workspaceId: string): Promise<PromptTemplate[]> {
  return api
    .get<{ templates: PromptTemplate[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/templates`)
    .then((r) => r.templates);
}

export function listTemplateLibrary(): Promise<PromptTemplate[]> {
  return api.get<{ templates: PromptTemplate[] }>("/prompt-templates").then((r) => r.templates);
}

export function createTemplate(input: TemplateCreateInput): Promise<PromptTemplate> {
  return api.post<{ template: PromptTemplate }>("/prompt-templates", input).then((r) => r.template);
}

export function updateTemplate(id: string, input: TemplateUpdateInput): Promise<PromptTemplate> {
  return api
    .patch<{ template: PromptTemplate }>(`/prompt-templates/${encodeURIComponent(id)}`, input)
    .then((r) => r.template);
}

export function deleteTemplate(id: string): Promise<void> {
  return api.del<void>(`/prompt-templates/${encodeURIComponent(id)}`);
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

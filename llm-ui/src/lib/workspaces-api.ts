import { api } from "./api";

// Thin typed wrappers over the llm-http /workspaces endpoints. Dates arrive
// as ISO strings from JSON; screens format them for display.

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

export interface WorkspacePage {
  items: WorkspaceSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface WorkspacePatch {
  name?: string;
  slug?: string;
}

export function listWorkspaces(page: number, limit: number): Promise<WorkspacePage> {
  return api.get<WorkspacePage>(`/workspaces?page=${page}&limit=${limit}`);
}

export function createWorkspace(input: { name: string; slug?: string }): Promise<WorkspaceSummary> {
  return api.post<WorkspaceSummary>("/workspaces", input);
}

export function getWorkspace(id: string): Promise<WorkspaceSummary> {
  return api.get<WorkspaceSummary>(`/workspaces/${encodeURIComponent(id)}`);
}

export function updateWorkspace(id: string, patch: WorkspacePatch): Promise<WorkspaceSummary> {
  return api.patch<WorkspaceSummary>(`/workspaces/${encodeURIComponent(id)}`, patch);
}

export function deleteWorkspace(id: string): Promise<void> {
  return api.del<void>(`/workspaces/${encodeURIComponent(id)}`);
}

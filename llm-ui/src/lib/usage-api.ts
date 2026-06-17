import { api } from "./api";

// Typed wrapper over the role-scoped usage aggregate. The server scopes the
// response to the caller: an admin gets org-wide totals, a member only their
// own workspaces. See llm-http `/api/dashboard/usage`.

export interface ProviderUsageWire {
  providerId: string | null;
  providerKind: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
}

export interface WorkspaceUsageWire {
  workspaceId: string;
  slug: string;
  name: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
}

export interface UsageResponse {
  byProvider: ProviderUsageWire[];
  byWorkspace: WorkspaceUsageWire[];
}

export function getUsage(): Promise<UsageResponse> {
  return api.get<UsageResponse>("/api/dashboard/usage");
}

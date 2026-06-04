import type { WorkspaceRole } from "@ai-connect/shared";

export interface StoredTemplateBinding {
  templateId: string;
  suggestedRole: WorkspaceRole;
}

export interface WsTemplateBindingsRepo {
  get(orgId: string, workspaceId: string): Promise<StoredTemplateBinding[]>;
  set(
    orgId: string,
    workspaceId: string,
    bindings: StoredTemplateBinding[],
  ): Promise<void>;
}

export class InMemoryWsTemplateBindingsRepo implements WsTemplateBindingsRepo {
  private readonly byKey = new Map<string, StoredTemplateBinding[]>();

  private static key(orgId: string, workspaceId: string): string {
    return `${orgId}::${workspaceId}`;
  }

  async get(
    orgId: string,
    workspaceId: string,
  ): Promise<StoredTemplateBinding[]> {
    const key = InMemoryWsTemplateBindingsRepo.key(orgId, workspaceId);
    return (this.byKey.get(key) ?? []).map((r) => ({ ...r }));
  }

  async set(
    orgId: string,
    workspaceId: string,
    bindings: StoredTemplateBinding[],
  ): Promise<void> {
    const key = InMemoryWsTemplateBindingsRepo.key(orgId, workspaceId);
    this.byKey.set(
      key,
      bindings.map((b) => ({ ...b })),
    );
  }
}

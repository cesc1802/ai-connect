export interface WsProviderBindingsRepo {
  get(orgId: string, workspaceId: string): Promise<string[]>;
  set(orgId: string, workspaceId: string, providerIds: string[]): Promise<void>;
}

export class InMemoryWsProviderBindingsRepo implements WsProviderBindingsRepo {
  private readonly byKey = new Map<string, string[]>();

  private static key(orgId: string, workspaceId: string): string {
    return `${orgId}::${workspaceId}`;
  }

  async get(orgId: string, workspaceId: string): Promise<string[]> {
    const key = InMemoryWsProviderBindingsRepo.key(orgId, workspaceId);
    return [...(this.byKey.get(key) ?? [])];
  }

  async set(
    orgId: string,
    workspaceId: string,
    providerIds: string[],
  ): Promise<void> {
    const key = InMemoryWsProviderBindingsRepo.key(orgId, workspaceId);
    this.byKey.set(key, [...providerIds]);
  }
}

import type { Connection, ConnectionRegistry } from "./connection-registry.js";

export class LocalConnectionRegistry implements ConnectionRegistry {
  private readonly byId = new Map<string, Connection>();
  private readonly byUser = new Map<string, Set<string>>();

  register(connection: Connection): void {
    const existing = this.byId.get(connection.id);
    if (existing && existing.userId !== connection.userId) {
      const oldUserSet = this.byUser.get(existing.userId);
      oldUserSet?.delete(connection.id);
      if (oldUserSet && oldUserSet.size === 0) {
        this.byUser.delete(existing.userId);
      }
    }
    this.byId.set(connection.id, connection);
    const userConnections = this.byUser.get(connection.userId) ?? new Set();
    userConnections.add(connection.id);
    this.byUser.set(connection.userId, userConnections);
  }

  unregister(connectionId: string): void {
    const connection = this.byId.get(connectionId);
    if (!connection) return;

    this.byId.delete(connectionId);
    const userConnections = this.byUser.get(connection.userId);
    userConnections?.delete(connectionId);
    if (userConnections && userConnections.size === 0) {
      this.byUser.delete(connection.userId);
    }
  }

  getByConnection(id: string): Connection | undefined {
    return this.byId.get(id);
  }

  getByUser(userId: string): Connection[] {
    const connectionIds = this.byUser.get(userId);
    if (!connectionIds) return [];
    return [...connectionIds]
      .map((id) => this.byId.get(id))
      .filter((c): c is Connection => c !== undefined);
  }
}

import type { Logger } from "pino";
import type { ConnectionRegistry } from "./connection-registry.js";
import type { MessageRouter } from "./message-router.js";

export class LocalMessageRouter implements MessageRouter {
  constructor(
    private readonly registry: ConnectionRegistry,
    private readonly logger: Logger
  ) {}

  sendToConnection(connectionId: string, payload: unknown): void {
    const connection = this.registry.getByConnection(connectionId);
    if (!connection) {
      this.logger.debug({ connectionId }, "router: connection not found");
      return;
    }
    connection.send(payload);
  }

  sendToUser(userId: string, payload: unknown): void {
    const connections = this.registry.getByUser(userId);
    for (const connection of connections) {
      connection.send(payload);
    }
  }
}

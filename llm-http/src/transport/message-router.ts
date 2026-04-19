export interface MessageRouter {
  sendToConnection(connectionId: string, payload: unknown): void;
  sendToUser(userId: string, payload: unknown): void;
}

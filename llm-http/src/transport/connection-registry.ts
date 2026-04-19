export interface Connection {
  id: string;
  userId: string;
  send(payload: unknown): void;
  close(): void;
}

export interface ConnectionRegistry {
  register(connection: Connection): void;
  unregister(connectionId: string): void;
  getByConnection(id: string): Connection | undefined;
  getByUser(userId: string): Connection[];
}

import type { Logger } from "../logger.js";

type EventHandler<E> = (event: E) => unknown | Promise<unknown>;

export interface EventBusOptions {
  logger?: Logger;
}

export class EventBus<E extends { type: string }> {
  private subs = new Map<E["type"], Set<EventHandler<E>>>();
  private logger: Logger | undefined;

  constructor(options?: EventBusOptions) {
    this.logger = options?.logger;
  }

  subscribe<T extends E["type"]>(
    type: T,
    handler: (event: Extract<E, { type: T }>) => unknown | Promise<unknown>
  ): () => void {
    const set = this.subs.get(type) ?? new Set<EventHandler<E>>();
    set.add(handler as EventHandler<E>);
    this.subs.set(type, set);
    return () => set.delete(handler as EventHandler<E>);
  }

  async publish(event: E): Promise<void> {
    const set = this.subs.get(event.type as E["type"]);
    if (!set || set.size === 0) return;

    const results = await Promise.allSettled(
      [...set].map((handler) =>
        Promise.resolve().then(() => handler(event))
      )
    );

    for (const result of results) {
      if (result.status === "rejected") {
        this.logger?.warn(
          { error: result.reason, eventType: event.type },
          "Event handler failed"
        );
      }
    }
  }
}

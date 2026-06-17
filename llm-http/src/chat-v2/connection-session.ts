import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { User, ChatEvent, ChatRequested, ConversationRepository, MessageRepository, ChatMessage, GuardrailPolicyRepository } from "@ai-connect/shared";
import { runGuardrails, type ChatRequest, type ModerationVerdict } from "llm-gateway";
import type { EventBus } from "../events/event-bus.js";
import type { ConnectionRegistry, Connection } from "../transport/connection-registry.js";
import type { ActiveWorkspaceResolver } from "../workspace/active-workspace-resolver.js";
import type { WorkspaceMembersRepository } from "../workspace/workspace-members-repository.js";
import type { WorkspaceTemplatesRepository } from "../workspace/workspace-templates-repository.js";
import type { Logger } from "../logger.js";
import type { ChatHandler } from "./chat-handler.js";
import { clientV2MessageSchema, type ClientV2Message } from "./client-message-schema.js";
import type { ServerV2Message } from "./server-message-types.js";

const BACKPRESSURE_LIMIT = 1_000_000;

export interface ConnectionSessionDeps {
  bus: EventBus<ChatEvent>;
  chatHandler: ChatHandler;
  registry: ConnectionRegistry;
  convRepo: ConversationRepository;
  msgRepo: MessageRepository;
  activeWorkspaceResolver: ActiveWorkspaceResolver;
  workspaceMembersRepository: WorkspaceMembersRepository;
  workspaceTemplatesRepository: WorkspaceTemplatesRepository;
  guardrailPolicyRepository: GuardrailPolicyRepository;
  moderate?: (text: string) => Promise<ModerationVerdict>;
  logger: Logger;
}

export class ConnectionSession {
  private ownedRequestIds = new Set<string>();
  private unsubs: Array<() => void> = [];
  private connectionId: string | null = null;

  constructor(
    private readonly ws: WebSocket,
    private readonly user: User,
    private readonly deps: ConnectionSessionDeps
  ) {}

  start(connectionId: string): void {
    this.connectionId = connectionId;
    const conn: Connection = {
      id: connectionId,
      userId: this.user.id,
      send: (payload) => this.sendWithBackpressure(payload as ServerV2Message),
      close: () => this.ws.close(),
    };
    this.deps.registry.register(conn);
    this.subscribeToBus();
    this.ws.on("message", (raw) => void this.onMessage(raw));
    this.ws.on("close", () => this.dispose());
  }

  private sendWithBackpressure(payload: ServerV2Message): void {
    if (this.ws.bufferedAmount > BACKPRESSURE_LIMIT) {
      this.deps.logger.warn({ user: this.user.username }, "v2 backpressure drop");
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }

  private subscribeToBus(): void {
    const filter = (requestId: string) => this.ownedRequestIds.has(requestId);

    this.unsubs.push(
      this.deps.bus.subscribe("stream.started", (e) => {
        if (!filter(e.requestId)) return;
        this.sendWithBackpressure({
          type: "s.chat.started",
          requestId: e.requestId,
          conversationId: e.conversationId,
          model: e.model,
          startedAt: e.startedAt,
        });
      })
    );

    this.unsubs.push(
      this.deps.bus.subscribe("token.generated", (e) => {
        if (!filter(e.requestId)) return;
        this.sendWithBackpressure({
          type: "s.chat.token",
          requestId: e.requestId,
          delta: e.delta,
          index: e.index,
        });
      })
    );

    this.unsubs.push(
      this.deps.bus.subscribe("stream.completed", (e) => {
        if (!filter(e.requestId)) return;
        this.ownedRequestIds.delete(e.requestId);
        this.sendWithBackpressure({
          type: "s.chat.completed",
          requestId: e.requestId,
          usage: e.usage,
          finishReason: e.finishReason,
          latencyMs: e.latencyMs,
        });
      })
    );

    this.unsubs.push(
      this.deps.bus.subscribe("stream.failed", (e) => {
        if (!filter(e.requestId)) return;
        this.ownedRequestIds.delete(e.requestId);
        this.sendWithBackpressure({
          type: "s.chat.failed",
          requestId: e.requestId,
          code: e.code,
          message: e.message,
        });
      })
    );

    this.unsubs.push(
      this.deps.bus.subscribe("stream.aborted", (e) => {
        if (!filter(e.requestId)) return;
        this.ownedRequestIds.delete(e.requestId);
        this.sendWithBackpressure({
          type: "s.chat.aborted",
          requestId: e.requestId,
          reason: e.reason,
        });
      })
    );
  }

  private async onMessage(raw: unknown): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      this.sendWithBackpressure({ type: "s.error", code: "invalid_json", message: "Invalid JSON" });
      return;
    }

    const result = clientV2MessageSchema.safeParse(parsed);
    if (!result.success) {
      this.sendWithBackpressure({
        type: "s.error",
        code: "invalid_message",
        message: result.error.issues[0]?.message ?? "Invalid message format",
      });
      return;
    }

    await this.dispatch(result.data);
  }

  private async dispatch(msg: ClientV2Message): Promise<void> {
    switch (msg.type) {
      case "c.chat.send":
        await this.handleChatSend(msg);
        break;
      case "c.chat.abort":
        this.handleChatAbort(msg);
        break;
      case "c.ping":
        this.sendWithBackpressure({ type: "s.pong" });
        break;
    }
  }

  private async handleChatSend(msg: Extract<ClientV2Message, { type: "c.chat.send" }>): Promise<void> {
    let conversationId = msg.conversationId;
    let templateId: string | undefined;
    // Resolved on both branches; required to look up the workspace guardrail
    // policy before the request leaves the system.
    let workspaceId: string;

    if (conversationId) {
      const conv = await this.deps.convRepo.get(conversationId);
      if (!conv) {
        this.sendWithBackpressure({ type: "s.error", code: "not_found", message: "Conversation not found" });
        return;
      }
      if (conv.userId !== this.user.id) {
        this.sendWithBackpressure({ type: "s.error", code: "forbidden", message: "Access denied" });
        return;
      }
      templateId = conv.templateId;
      workspaceId = conv.workspaceId;
    } else {
      // Resolve the target workspace: an explicit workspaceId (must be a member)
      // wins over the user's active workspace.
      if (msg.workspaceId) {
        const member = await this.deps.workspaceMembersRepository.isMember(this.user.id, msg.workspaceId);
        if (!member) {
          this.sendWithBackpressure({ type: "s.error", code: "forbidden", message: "Not a member of this workspace" });
          return;
        }
        workspaceId = msg.workspaceId;
      } else {
        const ws = await this.deps.activeWorkspaceResolver.getForUser(this.user.id);
        if (!ws) {
          this.sendWithBackpressure({ type: "s.error", code: "no_active_workspace", message: "No active workspace" });
          return;
        }
        workspaceId = ws.id;
      }
      if (msg.templateId) {
        const attached = await this.deps.workspaceTemplatesRepository.listForWorkspace(workspaceId);
        if (!attached.some((t) => t.id === msg.templateId)) {
          this.sendWithBackpressure({
            type: "s.error",
            code: "invalid_template",
            message: "Template is not attached to this workspace",
          });
          return;
        }
      }
      const now = Date.now();
      const conv = await this.deps.convRepo.create({
        workspaceId,
        userId: this.user.id,
        ...(msg.templateId ? { templateId: msg.templateId } : {}),
        createdAt: now,
        updatedAt: now,
      });
      conversationId = conv.id;
      templateId = msg.templateId;
      this.sendWithBackpressure({ type: "s.conversation.created", conversation: conv });
    }

    // The template body acts as the conversation's system prompt. It is
    // resolved fresh on every turn and never persisted as a message, so
    // template edits apply to future turns of conversations seeded from it.
    let systemMessage: ChatMessage | undefined;
    if (templateId) {
      const template = await this.deps.workspaceTemplatesRepository.getTemplate(templateId);
      if (template?.body) systemMessage = { role: "system", content: template.body };
    }

    const history = await this.deps.msgRepo.listByConversation(conversationId);
    const historyMessages: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
    // The persisted transcript is canonical; the client resends prior turns,
    // so only its newest message is appended to avoid duplicating history.
    const last = msg.messages[msg.messages.length - 1]!;
    const newMessage: ChatMessage = { role: last.role, content: last.content };
    if (last.name !== undefined) newMessage.name = last.name;
    if (last.toolCallId !== undefined) newMessage.toolCallId = last.toolCallId;
    const allMessages = [...(systemMessage ? [systemMessage] : []), ...historyMessages, newMessage];

    const requestId = randomUUID();
    this.ownedRequestIds.add(requestId);

    // Enforce the workspace guardrail policy BEFORE publishing: the redacted
    // request then flows to both the persister (store-redacted) and the gateway.
    // A block never publishes chat.requested — it emits a content-free failed
    // event, so no offending content reaches the transcript, provider, or logs.
    const policy = await this.deps.guardrailPolicyRepository.get(workspaceId);
    const guardrailInput: ChatRequest = {
      model: msg.model,
      messages: allMessages,
      maxTokens: msg.maxTokens ?? 4096,
      ...(msg.temperature !== undefined ? { temperature: msg.temperature } : {}),
    };
    const outcome = await runGuardrails(
      guardrailInput,
      policy,
      this.deps.moderate ? { moderate: this.deps.moderate } : {},
    );
    if (outcome.blocked) {
      await this.deps.bus.publish({
        type: "stream.failed",
        requestId,
        code: "guardrail_blocked",
        message: "Request blocked by guardrail policy",
      });
      return;
    }

    const chatRequest: ChatRequested = {
      type: "chat.requested",
      requestId,
      userId: this.user.id,
      conversationId,
      workspaceId,
      model: msg.model,
      messages: outcome.request.messages,
    };
    if (msg.maxTokens !== undefined) chatRequest.maxTokens = msg.maxTokens;
    if (msg.temperature !== undefined) chatRequest.temperature = msg.temperature;

    await this.deps.bus.publish(chatRequest);
  }

  private handleChatAbort(msg: Extract<ClientV2Message, { type: "c.chat.abort" }>): void {
    if (!this.ownedRequestIds.has(msg.requestId)) {
      this.sendWithBackpressure({ type: "s.error", code: "forbidden", message: "Cannot abort unowned request" });
      return;
    }
    this.deps.chatHandler.abort(msg.requestId, "manual");
  }

  private dispose(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    if (this.connectionId) {
      this.deps.registry.unregister(this.connectionId);
    }
    for (const requestId of this.ownedRequestIds) {
      this.deps.chatHandler.abort(requestId, "client");
    }
    this.ownedRequestIds.clear();
  }
}

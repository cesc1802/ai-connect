# Phase 03 — In-Memory Repositories (Conversation + Message)

## Context Links
- Brainstorm: `../reports/brainstorm-260419-1958-event-driven-chat-architecture.md`
- Phase 1 interfaces: `phase-01-foundation-event-types-and-bus.md` (`ConversationRepository`, `MessageRepository`)
- Existing in-memory pattern: `llm-http/src/auth/in-memory-user-repository.ts`

## Overview
- **Priority:** P1 (blocks Phase 5 conversation resolve, Phase 6 persistence handler)
- **Status:** completed
- **Description:** Implement `InMemoryConversationRepository` + `InMemoryMessageRepository` against Phase 1 interfaces. Real interfaces, fake storage — handlers fully functional now; future `llm-db` package swaps in Postgres impl with zero handler changes.

## Key Insights
- Match the auth-package pattern (`InMemoryUserRepository`) — `Map`-backed, async signatures
- Async signatures even for sync ops (Promise.resolve()) so DB swap is non-breaking
- Generate IDs via `randomUUID()` — repo owns ID gen, callers never supply
- `partial: true` flag on Message supports abort/timeout (Phase 6 persistence handler sets it)
- README/Phase 7 must call out: NOT FOR PROD — restart loses all data

## Requirements
**Functional**
- `InMemoryConversationRepository`: `create({userId, title?})`, `get(id)`, `listByUser(userId)`, `updateTitle(id, title)`
- `InMemoryMessageRepository`: `append({conversationId, role, content, partial?})`, `listByConversation(conversationId)`
- All return Promises
- Conversation list ordered by `updatedAt desc`; message list ordered by `createdAt asc`
- `updatedAt` bumped on `updateTitle` and on every `append`

**Non-functional**
- Files <200 LOC each
- O(1) by-id lookups; O(n) list operations acceptable for in-memory
- No external persistence — restart = data loss (documented)

## Architecture
```
InMemoryConversationRepository
  byId: Map<convId, Conversation>
  byUser: Map<userId, Set<convId>>

InMemoryMessageRepository
  byConv: Map<convId, Message[]>           // append-ordered
  uses event bus? NO — repo is passive; Phase 6 PersistenceHandler calls it
```
Data flow: Phase 6 `PersistenceHandler` subscribes to `chat.requested` + `stream.completed` + `stream.aborted` and calls these repos. Phase 5 server calls `conversationRepo.get` + `messageRepo.listByConversation` to load history before publishing `chat.requested`.

## Related Code Files
**Create:**
- `llm-http/src/repositories/in-memory-conversation-repo.ts`
- `llm-http/src/repositories/in-memory-message-repo.ts`
- `llm-http/src/repositories/__tests__/in-memory-conversation-repo.test.ts`
- `llm-http/src/repositories/__tests__/in-memory-message-repo.test.ts`

**Modify:** none

**Delete:** none

## Implementation Steps
1. Create `in-memory-conversation-repo.ts`:
   ```ts
   import { randomUUID } from "node:crypto";
   import type { Conversation, ConversationRepository } from "@ai-connect/shared";

   export class InMemoryConversationRepository implements ConversationRepository {
     private byId = new Map<string, Conversation>();
     private byUser = new Map<string, Set<string>>();

     async create(input: { userId: string; title?: string }): Promise<Conversation> {
       const now = Date.now();
       const conv: Conversation = {
         id: randomUUID(),
         userId: input.userId,
         title: input.title,
         createdAt: now,
         updatedAt: now,
       };
       this.byId.set(conv.id, conv);
       const set = this.byUser.get(conv.userId) ?? new Set();
       set.add(conv.id);
       this.byUser.set(conv.userId, set);
       return conv;
     }
     async get(id: string): Promise<Conversation | undefined> { return this.byId.get(id); }
     async listByUser(userId: string): Promise<Conversation[]> {
       const ids = this.byUser.get(userId) ?? new Set();
       return [...ids]
         .map((id) => this.byId.get(id)!)
         .sort((a, b) => b.updatedAt - a.updatedAt);
     }
     async updateTitle(id: string, title: string): Promise<void> {
       const c = this.byId.get(id);
       if (!c) return;
       c.title = title;
       c.updatedAt = Date.now();
     }
   }
   ```
2. Create `in-memory-message-repo.ts`:
   ```ts
   export class InMemoryMessageRepository implements MessageRepository {
     constructor(private readonly conversationRepo: ConversationRepository) {}
     private byConv = new Map<string, Message[]>();
     async append(input: { conversationId: string; role: Message["role"]; content: string; partial?: boolean }): Promise<Message> {
       const msg: Message = {
         id: randomUUID(),
         conversationId: input.conversationId,
         role: input.role,
         content: input.content,
         partial: input.partial,
         createdAt: Date.now(),
       };
       const arr = this.byConv.get(input.conversationId) ?? [];
       arr.push(msg);
       this.byConv.set(input.conversationId, arr);
       // bump conversation updatedAt — easiest via touchUpdatedAt method on conv repo;
       // for now just re-fetch + setattr, since both repos share process
       const conv = await this.conversationRepo.get(input.conversationId);
       if (conv) conv.updatedAt = msg.createdAt;
       return msg;
     }
     async listByConversation(id: string): Promise<Message[]> {
       return [...(this.byConv.get(id) ?? [])];
     }
   }
   ```
   Note: mutating `conv.updatedAt` directly is OK for in-memory; future DB impl uses proper UPDATE.
3. Tests for conversation repo:
   - `create` returns conv with id + timestamps
   - `get(unknown)` returns undefined
   - `listByUser(userId)` returns user's convs sorted by updatedAt desc
   - `updateTitle` mutates title + bumps updatedAt
   - Two users isolated (user A doesn't see user B's convs)
4. Tests for message repo:
   - `append` returns Message with id + timestamp
   - `listByConversation` returns insertion order
   - `append` bumps parent conv `updatedAt`
   - `partial: true` round-trips
   - `listByConversation(unknown)` returns `[]`

## Todo List
- [x] Implement `InMemoryConversationRepository`
- [x] Implement `InMemoryMessageRepository`
- [x] Conversation repo tests (CRUD + multi-user isolation)
- [x] Message repo tests (append/list + partial flag)
- [x] Verify `tsc --noEmit` clean

## Success Criteria
- Both repos implement Phase 1 interfaces, no `any`
- All tests pass with fake clock-free assertions (use `expect(typeof updatedAt).toBe("number")`, ordering by relative compare)
- Multi-user isolation verified
- `partial: true` flag round-trips
- `appendMessage → conversation.updatedAt updated` verified

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Memory growth unbounded over time | High | High | DOC: NOT FOR PROD; Phase 7 README warning |
| Mutating conv.updatedAt from message repo couples repos | Med | Low | Acceptable for in-memory; DB impl has no such coupling (UPDATE statement) |
| ID collision via `randomUUID` | Negligible | High | Native Node crypto; collision probability ~0 |
| Cross-user data leak | Med | Critical | `listByUser` keyed on userId; Phase 5 must pass authenticated user only |

## Security Considerations
- Repo trusts caller to pass correct `userId` — Phase 5/6 must always derive from JWT, never client payload
- No content scrubbing/PII filtering at this layer
- `get(id)` does NOT enforce ownership — Phase 5 must check `conv.userId === ws.user.id` before loading history (CRITICAL — call out in Phase 5)

## Next Steps
- **Depends on:** Phase 1 (interfaces + types)
- **Blocks:** Phase 5 (history load), Phase 6 PersistenceHandler (writes both repos)
- **Future:** `llm-db` package implements same interfaces with Postgres + Drizzle; container swap in Phase 7 → no handler changes

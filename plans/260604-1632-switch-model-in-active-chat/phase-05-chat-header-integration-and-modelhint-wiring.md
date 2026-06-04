---
phase: 5
title: "Chat Header Integration and ModelHint Wiring"
status: pending
priority: P2
effort: "2h"
dependencies: [3, 4]
---

# Phase 5: Chat Header Integration and ModelHint Wiring

## Overview

Mount `<ModelSelector />` in the chat-page header strip and read the chat-model store inside `useChatSession.sendMessage` to attach `modelHint` to outbound `c.chat.send` commands. Critical invariant: BR-085 — switching models never aborts an in-flight reply.

## Requirements

- **Functional:** UC-021 step 5 (header shows new model name) and step 6 (next send carries new model id).
- **Non-functional:** BR-085 — no abort of in-flight stream. The selector must not call `client.send` or `abort`; only the store changes.

## Architecture

Two surgical edits:

1. **`llm-ui/src/pages/chat-page.tsx`** — inject `<ModelSelector />` in the header div (lines 57-62). Keep "Conversation"/"New conversation" label on the left, add `<ModelSelector />` in the middle, keep `<ConnectionStatusBadge />` on the right.
2. **`llm-ui/src/hooks/use-chat-session.ts`** — extend `SendMessageInput` with optional `modelHint`, or read it directly from the store inside `sendMessage`. Prefer the latter to avoid plumbing through `chat-page.tsx`:

   ```ts
   // inside sendMessage
   const sel = useChatModelStore.getState().getModel(input.workspaceId);
   const modelHint = sel ? `${sel.providerId}/${sel.modelId}` : undefined;
   s.client.send({
     type: 'c.chat.send',
     conversationId: input.conversationId,
     workspaceId: input.workspaceId,
     message: { role: 'user', content: input.text },
     ...(modelHint ? { modelHint } : {}),
   });
   ```

   This keeps `sendMessage`'s caller API unchanged and centralizes the encoding decision.

## Related Code Files

- Modify: `llm-ui/src/pages/chat-page.tsx` (header layout)
- Modify: `llm-ui/src/hooks/use-chat-session.ts` (`sendMessage` reads chat-model store)

## Implementation Steps

1. Edit `chat-page.tsx` header div: add `<ModelSelector />` between the title and the `<ConnectionStatusBadge />`. Use `gap-2` and `min-w-0` so it truncates on narrow viewports.
2. Edit `use-chat-session.ts`:
   - Import `useChatModelStore`.
   - In `sendMessage`, read `useChatModelStore.getState().getModel(input.workspaceId)`.
   - Encode as `"providerId/modelId"` (per plan Open Question 1 — confirm before merging).
   - Conditionally spread `modelHint` into the WS payload.
3. Verify `ChatSendCmd` schema already permits `modelHint` (`llm-ui/src/schemas/ws-events.ts:13` — yes, optional string).
4. Manual smoke: dev mode, MSW on, pick a model, hit send, inspect outbound WS frame in DevTools — confirm `modelHint` present and well-formed.
5. Manual smoke for BR-085: start a long reply, change the model mid-stream, observe that the stream continues uninterrupted; the next send uses the new model.
6. Run `pnpm --filter @ai-connect/ui {typecheck,test}`.

## Success Criteria

- [ ] Header renders the model selector in the chat page (visible on `/chat` and `/chat/$conversationId`).
- [ ] Outbound `c.chat.send` includes `modelHint` only when the user has selected a model.
- [ ] Switching the model during a streaming reply does not abort the reply (BR-085).
- [ ] Switching the model does not trigger any other side effects (no extra WS messages, no React-Query refetches besides the one TanStack Query already runs).
- [ ] `pnpm --filter @ai-connect/ui typecheck` + Vitest exit 0.

## Risk Assessment

- **Risk:** Reading Zustand inside `sendMessage` via `getState()` skips subscriptions, which is desired here (we want the value at send-time, not at render-time). **Mitigation:** explicit comment in code documenting why `getState()` not `useChatModelStore(...)` is used.
- **Risk:** Header layout drift on small viewports. **Mitigation:** rely on existing `flex items-center justify-between` + apply `min-w-0` + truncation on the selector label.
- **Risk:** Plumbing through `SendMessageInput` instead of `getState` would expose the encoding decision to every caller. **Mitigation:** centralize in `sendMessage` (decision locked in this phase).

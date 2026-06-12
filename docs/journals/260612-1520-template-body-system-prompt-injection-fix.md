# Template Body Never Injected as System Prompt — Bug Fix

**Date**: 2026-06-12 15:20
**Severity**: High (core feature silently inert)
**Component**: llm-http (chat-v2, workspace)
**Status**: Resolved

## What Happened

User report: selecting a prompt template at new-chat creation had zero effect on the conversation. Diagnosis: feature was half-built. Template selection UI worked, `templateId` traveled client → WebSocket → conversation record (`connection-session.ts` stored it via `convRepo.create`), but the template **body** was never read again. Template was treated as display metadata, not instruction content — `chat.requested` events carried only history + new user message.

Fix: added `getTemplate(id)` to `WorkspaceTemplatesRepository` (interface + Drizzle impl), and `handleChatSend` now resolves the conversation's `templateId` (from conversation record on existing chats, from `msg.templateId` on creation) and prepends `{role: "system", content: template.body}` to the published message stream.

## Key Design Decision

System prompt is **resolved fresh on every turn and never persisted**. Safe because `message-persister.ts` only persists the last user message + assistant turns — the prepended system message can't leak into the transcript or duplicate on later turns. Consequence: template edits apply to future turns of conversations seeded from them; conversation `templateId` FK is `onDelete: set null`, and a deleted/missing template degrades gracefully to no system message.

Trust boundary preserved: `msg.templateId` is ignored for existing conversations (server reads the stored one), so clients can't inject arbitrary templates into existing chats; at creation the pre-existing workspace-attachment check still gates it.

## Verification

- 3 regression tests in `connection-session.test.ts` — confirmed failing without fix (git stash), passing with it
- 1 new Drizzle test for `getTemplate` — 8/8 against local Postgres
- Full llm-http suite: 442 passed; typecheck + build clean
- Independent code-reviewer pass: APPROVE, no blocking findings

## Lessons

1. **"Stored but never read" is the signature of a half-shipped feature.** The data flow looked complete at every checkpoint (UI ✓, schema ✓, persistence ✓) — only tracing the value to its consumption point (the LLM request) revealed it dead-ended.
2. Tracing where persisted fields are *read* should be part of feature review, not just where they're written.

## Open Questions

- Detached templates keep applying to existing conversations (`getTemplate` is id-only, attachment checked only at creation). Reviewer flagged as design choice, not defect. Confirm intended product semantics; if detach should stop applying, scope `getTemplate` by workspace.
- Pre-existing gap: `onMessage` dispatch chain has no try/catch — any repo failure (now incl. `getTemplate`) surfaces as unhandled rejection instead of an `s.error` frame. Out of scope here, worth a follow-up.

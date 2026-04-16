---
date: 2026-04-16
type: journal
phase: "Phase 4: Anthropic Provider"
commit: d1d53da
---

# Phase 4: Anthropic Provider Implementation

## Context

Implementing the Anthropic provider adapter for llm-gateway package using official `@anthropic-ai/sdk`. First provider implementation following base provider architecture from Phase 3.

## What Happened

### Implementation (~300 lines)
- `AnthropicProvider` class extending `BaseProvider`
- `chatCompletion()` with SDK integration
- `streamCompletion()` as AsyncIterable with event handling
- Message mapping: system extraction, tool results as user messages
- Tool definition and tool choice mapping
- Vision support for base64 images

### Code Review Fixes
| Issue | Fix |
|-------|-----|
| Non-null assertion on `toolCallId` | Added ValidationError |
| URL images passed to SDK | Throw ValidationError (base64 only) |
| `currentToolCallId` never cleared | Added `content_block_stop` handler |
| Memory leak on errors | Cleanup `startTime` Map in catch |

### Testing
- 29 new tests, 104 total passing
- Mocked SDK with custom APIError class

## Decisions

1. **Base64-only images** - SDK limitation
2. **ValidationError preservation** - Pass through without wrapping
3. **Tool results as user messages** - Anthropic format requirement

## Next Steps

- Phase 5: OpenAI Provider
- Phase 6: Ollama + MiniMax

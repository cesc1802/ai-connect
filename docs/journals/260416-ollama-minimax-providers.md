---
date: 2026-04-16
type: journal
phase: "Phase 6: Ollama & MiniMax Providers"
commit: 2a06ecb
---

# Phase 6: Ollama & MiniMax Provider Implementation

## Context

Implementing two specialized LLM providers: Ollama (local inference) and MiniMax (China-based API). Both required solving distinct streaming and resource-cleanup challenges.

## What Happened

### Ollama Provider (~400 lines)
- Fetch-based local inference (no SDK dependency)
- NDJSON streaming with buffer concatenation (newlines split partial JSON)
- Vision via base64 image encoding
- Tool calling support
- Critical: `reader.releaseLock()` in finally block prevents stream hangs

### MiniMax Provider (~300 lines)
- API key + group ID authentication
- SSE streaming format (different from NDJSON)
- Error mapping: 401→AuthError, 429→RateLimitError
- Resource cleanup with releaseLock()

### Code Review Fixes
| Issue | Resolution |
|-------|-----------|
| Unhandled JSON.parse errors in streams | try-catch per chunk |
| Stream readers not released on error | finally block for releaseLock() |
| TypeScript exactOptionalPropertyTypes | Made optional fields truly optional |

## Key Learning

**Streaming is fragile**: Partial reads corrupt JSON parsing. Buffer concatenation on newline boundaries prevented silent failures. Forgetting `releaseLock()` caused tests to hang indefinitely—this is a hidden gotcha in ReadableStream usage.

## Metrics
- 167 tests passing
- 5 files modified, ~1125 LOC
- Zero production issues on first merge

## Next Steps
- Phase 7: Integration testing across all providers
- Phase 8: Performance benchmarking under load

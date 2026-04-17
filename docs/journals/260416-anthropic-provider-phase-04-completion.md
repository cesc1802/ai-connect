# Anthropic Provider Implementation Complete (Phase 4)

**Date**: 2026-04-16
**Severity**: Medium
**Component**: llm-gateway/src/providers/anthropic-provider.ts
**Status**: Resolved

## What Happened

Completed full AnthropicProvider implementation (~300 lines) with streaming, tool calling, vision support, and comprehensive error mapping. Implementation integrated with existing BaseProvider interface pattern. 29 new tests added; all 104 tests passing.

## The Brutal Truth

Code review revealed we'd been too loose with safety assumptions. Used non-null assertions on toolCallId without validation, attempted to support URL images against Anthropic SDK limitations, and had memory leaks in error paths via uncleaned startTime Map entries. These weren't major bugs but exposed slack in defensive programming discipline — we patched them cleanly.

## Technical Details

**Critical fixes applied:**
- toolCallId validation: now checks existence before tool message construction (was `message.toolCallId!`)
- URL image handling: throws ValidationError immediately (Anthropic only accepts base64)
- Tool call tracking: clear currentToolCallId on content_block_stop event to prevent state carryover
- Memory management: clean startTime Map entries in error handlers, not just success paths

**Error mapping** covers real-world scenarios:
- 401 → AuthenticationError
- 429 → RateLimitError (with retry-after header parsing)
- 404 → ModelNotFoundError
- ValidationError intentionally preserved (not wrapped)

## What We Tried

Initial implementation used optional chaining for toolCallId. Code review flagged the risk: downstream code assumes toolCallId exists for tool_result blocks. Solution: explicit null check with descriptive error instead.

For URL images, initially tried converting to data URI inline. Realized Anthropic SDK doesn't support that natively. Rather than maintain conversion logic, decided to fail fast with clear ValidationError — callers must provide base64.

## Root Cause Analysis

These issues weren't design flaws but careless shortcuts:
1. Trusting that previous validation guaranteed toolCallId existence (it doesn't always)
2. Assuming URL image support would be easy to add (it requires client-side handling)
3. Forgetting cleanup in error paths (muscle memory from success-path-only testing)

All addressable through deliberate verification, not architectural changes.

## Lessons Learned

- **Validate at boundaries**: Don't trust that upstream code did its job. Check again at construct time.
- **Know your SDK limits**: Anthropic SDK base64-only decision is a constraint, not a suggestion. Document and enforce early.
- **Error paths need love too**: Tests pass on happy path, but memory leaks hide until production. Run error scenarios explicitly.
- **Tool calling is state machine work**: currentToolCallId Map requires careful bookkeeping. Every terminal event (stop, error) must clean state.

## Next Steps

- Monitor Anthropic rate limiting behavior in staging (retry-after parsing untested in production)
- Document base64-image-only requirement in provider README
- Consider adding image encoding utility for common formats
- Anthropic provider stable; ready for integration testing with gateway orchestrator

---

**Commit**: d1d53da – feat(llm-gateway): implement Anthropic provider with streaming and tool support

**Test Coverage**: 104 tests (29 new for Anthropic), all passing

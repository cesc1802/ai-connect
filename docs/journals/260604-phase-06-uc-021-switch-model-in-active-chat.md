# UC-021: Switch Model in Active Chat — Feature Complete

**Date**: 2026-06-04 17:30
**Severity**: Informational
**Component**: llm-ui chat model selector
**Status**: Shipped

## What Shipped

Workspace-scoped model picker in chat header. User can switch LLM provider/model mid-conversation without breaking stream. Shapes: Zod schemas (ProviderKind, Model, Provider, WorkspaceResourcesResponse), MSW fixture handler with role+isEnabled filters, TanStack Query hook with 30s staleTime + always-refetch on mount, Zustand store per-workspace + persist, shadcn DropdownMenu (ScrollArea, role override for a11y), integration into sendMessage via modelHint="providerId/modelId" spread.

5 new test files, 28 tests, 74 total green. Zero axe-core violations.

## Key Decisions & Rationale

**modelHint encoding**: "providerId/modelId" slash form. UC-015 (backend) not shipped. Built to Zod spec + MSW; swap is mechanical when backend lands. Delaying implementation was costlier than mirroring.

**Skipped worktree isolation**: Plan was mostly sequential P1→{P2,P3}→P4→P5→P6. Worktree branching + merges would exceed parallelism win. One developer sprint-mode beat two devs with coordination tax.

**A11y graceful degrade**: Radix DropdownMenu accepted role="listbox"/"option" overrides directly (Option A). Fallback manual Popover (Option B) unnecessary. axe-core validation = 0 serious/critical.

**Mid-stream switch safety (BR-085)**: Read useChatModelStore.getState() inside sendMessage rather than subscribing. Captures model choice at send-time only, prevents abort edge case if user switches during inflight.

## Team Coordination Reality

Dev-2 idle-spun while dev-1 sprinted T1→T2→T3→T4→T5. Dev-2 ended verifying-only on completed files. Direct ping eventually woke dev-2 but was redundant. Lesson: tight sequential DAGs + small team = 1 dev faster than 2. Parallelism requires actual independent tracks; fake independence burns cycles.

## What Went Right

- Zod schema-first reduced backend-mock friction
- Persist store + logout teardown (module-level subscribe) clean
- 30s staleTime balanced UX freshness vs network spam
- Role filter enforcement on fixture side catches policy bugs early

## Next

UC-015 (backend resources endpoint) ships → swap modelHint shape in one change. No breaking code restructure needed.

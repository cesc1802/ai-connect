# Durable Cook Step Tracker: Advisory Reminder Without Hard Enforcement

**Date**: 2026-06-17 10:59
**Severity**: Medium
**Component**: `.claude/hooks` — cook workflow orchestration
**Status**: Completed with intentional gap

## What Happened

Built a hook-driven step-tracker for the `ck:cook` workflow so the LLM never silently skips a mandatory step mid-run. The tracker is purely advisory: it persists progress to `.claude/session-state/active-workflow.json`, auto-advances on `SubagentStop` events, and re-injects a progress line every turn + after session compaction. Hard gating remains delegated to the existing `workflow-artifact-gate.cjs`.

Files created under `.claude/` (gitignored, untracked):
- `schemas/cook-workflow-steps.json` — 9-step manifest (scout → research → plan → implement → simplify → test → code-review → finalize → journal). Each step has `id`, `label`, `gated` flag, and `detectOn` (subagent type for auto-advance, or `null` for reminder-only).
- `hooks/lib/workflow-step-manager.cjs` (233 LOC) — pure/impure-separated state machine. loadState/persistState atomic (tmp+rename). renderProgress uses glyphs: ✓ done, ▶ current, 🔒 gated-blocked, ☐ todo.
- `hooks/cook-step-tracker.cjs` (113 LOC) — crash-wrapped, fail-open, `isHookEnabled` gated. Hooks UserPromptSubmit (detect `/ck:cook` start, print progress) and SubagentStop (auto-advance, clear state on journal completion).
- Modified `settings.json` to wire the hook (UserPromptSubmit, SubagentStop, SessionStart:compact events).
- Modified `hooks/lib/ck-config-utils.cjs` to add hook to DEFAULT_CONFIG.hooks.
- 28 unit tests (17 state-manager, 11 hook integration), all pass. Existing 91 test suites still pass.

## The Brutal Truth

The one honest gap: **live E2E (post-install fresh cook run + forced compaction) was never executed**. We have automated dispatch tests covering the compaction branch, but a human pressing `/ck:cook`, watching the hook re-inject progress, then triggering a compaction and verifying the checklist survived — that didn't happen. It's the interaction that matters most, and we didn't walk it.

The intentional design tradeoff is that this tracker only _reminds_, never _blocks_. If an LLM somehow completes finalize without running journal, the hard gate still kills the finalize output (artifact-gate.cjs unchanged). But the soft reminder is what prevents the silent drift in the first place. We chose over-reminding (scout/implement stay in "current" forever if never auto-detected) over false confidence (marking them done prematurely).

## Technical Details

State file: `.claude/session-state/active-workflow.json`
```json
{
  "runId": "20260617-1059-...",
  "manifest": "cook-workflow-steps.json",
  "steps": [
    { "id": "scout", "label": "Scout", "status": "done", "completedAt": "..." },
    { "id": "research", "label": "Research", "status": "current" },
    ...
  ],
  "currentStep": "research",
  "gatedStep": "finalize"
}
```

detectOn mapping:
- `scout` → null (inline, reminded never auto-ticked)
- `research` → "researcher"
- `plan` → "planner"
- `implement` → null (inline)
- `simplify` → "simplifier"
- `test` → "tester"
- `code-review` → "code-reviewer"
- `finalize` → gated until prior 7 steps complete
- `journal` → "journal-writer"

Hook outlets:
- **UserPromptSubmit**: parse user message for `/ck:cook`; if match, `initRun()`; if active run exists, `renderProgress()` to stdout (becomes injected context).
- **SubagentStop**: extract `subagent_type` from event, call `advanceBySubagent(subagent_type)`, render, clear state if journal done.
- **SessionStart (compact matcher)**: reprint progress so checklist survives compaction merge.

## What We Tried

1. **Hard enforcement (rejected)**: gating steps in the hook itself. Problem: duplicates artifact-gate logic, creates two points of control, increases brittleness. Decision: advisory only, reuse artifact-gate.
2. **Auto-complete scout/implement (rejected)**: auto-tick them when first input/code appears. Problem: false confidence, hides a step being skipped. Decision: keep them as `detectOn:null`, so they stay "current" and keep getting reminded.
3. **Persist to `.claude/session-state/` vs git history**: chose ephemeral session state, cleared at run-end. No churn, no merge conflicts, no "stale runs" clutter.

## Root Cause Analysis

The gap exists because live E2E was explicitly de-scoped in phase-03 to avoid a long manual walk-through that a single human tester would have to repeat. The automated dispatch test for compaction logic is solid (test harness constructs a `compact` payload, verifies step progression), but it doesn't exercise the actual hook event pipeline or the human's experience of reading re-injected checklists across a 9-step run.

Why this happened: planning was risk-conscious about scope; we optimized for "will the code never crash" (testable, automated) over "will the human never get lost" (ephemeral, manual to verify). The code won't crash — but its real value (preventing silent drops mid-run) is only validated if a human has actually felt the reminder jump in.

## Lessons Learned

1. **Advisory beats hard enforcement** when you're building atop existing gates. Fail-open (exit 0 on all errors) is the right guardrail for hooks.
2. **detectOn:null is a safety pattern**: over-reminding is better than false checkmarks. If you're unsure a step really completed, keep reminding.
3. **Atomic state persists matter**: tmp+rename+fs.sync prevents half-written state on crash. One extra 3ms for safety is always correct on the hot path.
4. **Unit tests without E2E E-mail confidence loss**: 28 tests passing doesn't fill the gap that only a live run can. For hooks touching the human's UX, live E2E is the last mile.
5. **Session-state gitignore is correct**: no clutter, no merge conflicts. But it means the only artifact of a run is the journal entry written by `/ck:journal`.

## Next Steps

- **Live E2E walkthrough (future)**: after next `/ck:cook` invocation, observer should note (a) progress line re-injected after each SubagentStop, (b) checklist survives compaction, (c) finalize remains gated until journal complete. Document outcome in a follow-up journal if any breakage found.
- **Monitoring**: if `cook-step-tracker.cjs` errors are ever logged, grep `.claude/session-state/active-workflow.json` for stale state and `clearState()` manually. Keep the state file ephemeral (cleared at SubagentStop when journal completes).
- **Feedback loop**: once a user runs `/ck:cook` with the tracker live, gather whether the checklist actually prevented a silent step drop. If not, revisit detectOn rules for false-negative detection.

## Decisions Locked In

- ✓ Advisory-not-enforcing design: verified by design, not reversed.
- ✓ detectOn:null for scout/implement: intentional, not a bug.
- ✓ Fail-open (exit 0) for hook: verified by test harness, production-safe.
- ✓ No product code, no new runtime deps, no DB: verified by file audit and package.json diff.
- ⚠️ E2E gap acknowledged but accepted: phase-03 success criteria, deferred to live run.

---

**Code files:** All under `.claude/` (gitignored). No product code modified.
**Test coverage:** 28 new tests, 91 existing suites pass.
**Artifact gate:** Reused as-is, no changes.

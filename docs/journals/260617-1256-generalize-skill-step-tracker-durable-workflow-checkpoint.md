# Generalized Skill-Step-Tracker: Convention-Scanned Durable Progress Engine

**Date**: 2026-06-17 12:56  
**Severity**: Low  
**Component**: `.claude/hooks/`, workflow step tracking  
**Status**: Complete

## What Happened

Transformed `cook-step-tracker.cjs` from a single-skill hook into a skill-agnostic manifest-driven engine. Any CK skill (plan, fix, cook, test, etc.) now gets durable, compaction-surviving progress checklist by dropping a `{skill}-workflow-steps.json` into `.claude/schemas/`. Zero hook code edits required per new skill — convention-scanning via `loadManifests()` discovers them automatically. Renamed hook from cook-specific to `skill-step-tracker.cjs`, migrated existing cook workflow, added plan and fix workflow manifests. All 41 targeted tests pass; full `.claude/` suite: 730 pass, 11 pre-existing unrelated failures. Code review: DONE_WITH_CONCERNS, ship-ready. Work local-only (`.claude/` is gitignored).

## The Brutal Truth

This was overdue generalization that felt heavy upfront but unlocked zero-friction workflow capture. The old `cook-step-tracker.cjs` had hardcoded step logic (9 steps, hardcoded labels, hardcoded detection). Adding a new workflow (plan, fix, test) required touching hook code, which meant hook versioning, testing, risk. The pain point: every new skill needing progress tracking meant a new hook or a massive parameter explosion.

Flipping to manifests was the right architectural call — manifest files are declarative data, not code. But the learning cost was real: had to think through what makes a step "detectable" (the `detectOn` subagent type), what makes a workflow "done" (the `terminalStep`), and how to fail open (advisory-only injection, never blocks). The invariant I nearly missed: a `terminalStep` with `detectOn: null` would keep reminding forever because nothing can ever mark it done. That's now a test assertion — no silent state-stranding.

Code review flagged one actionable gap (M1): test now asserts every manifest's `terminalStep` has non-null `detectOn`. Applied. Ship-ready.

## Technical Details

**Files changed:**
- RENAMED `cook-step-tracker.cjs` → `skill-step-tracker.cjs` (manifest dispatch logic)
- MODIFIED `workflow-step-manager.cjs` (engine): added `loadManifests()` (convention-scan `.claude/schemas/*-workflow-steps.json`), rewrote `findManifestByPrompt()` (regex matching against prompt text), rewrote `loadManifest()` (no longer returns nested steps, scans instead), `initRun()` now persists `terminalStep` for cleanup detection
- NEW `.claude/schemas/cook-workflow-steps.json`: migrated 9 cook steps, added `triggers: ["^/ck:cook"]`, added `terminalStep: "step_cook_09_ship"`
- NEW `.claude/schemas/plan-workflow-steps.json`: 3-step workflow (setup, research, plan), triggers: `["^/ck:plan"]`, terminalStep: `"step_plan_03_finalize_plan"`
- NEW `.claude/schemas/fix-workflow-steps.json`: 4-step workflow (scout, understand, fix, test), triggers: `["^/ck:fix"]`, terminalStep: `"step_fix_04_test_and_verify"`
- MODIFIED `.claude/hooks/lib/ck-config-utils.cjs`: config key `cook-step-tracker` → `skill-step-tracker`
- MODIFIED `.claude/settings.json`: 3 hook wirings repointed to new hook
- TESTS: `.claude/hooks/__tests__/skill-step-tracker.test.cjs` (renamed/extended, 18 cases), `.claude/hooks/lib/__tests__/workflow-step-manager.test.cjs` (extended, 23 new cases for manifest loading + prompt matching)

**Manifest Structure** (self-describing):
```json
{
  "skill": "cook",
  "triggers": ["^/ck:cook"],
  "terminalStep": "step_cook_09_ship",
  "steps": [
    {
      "id": "step_cook_01_plan",
      "label": "Cook: Phase 1 — Planning",
      "gated": false,
      "detectOn": "planner"
    },
    { ... },
    {
      "id": "step_cook_09_ship",
      "label": "Cook: Phase 9 — Ship",
      "gated": false,
      "detectOn": "shipper"
    }
  ]
}
```

**Key Design Locks:**
- **Convention over registry**: `loadManifests()` glob-scans `.claude/schemas/*-workflow-steps.json`, no central registry to update. New skill = new file, hook code unchanged.
- **`detectOn` field**: subagent type (e.g., `"planner"`, `"tester"`, `"shipper"`, `null`). When a SubagentStop event fires with matching type, that step auto-advances. `null` = reminder-only (safe default, never false-positives).
- **Single active run**: starting a new tracked skill overwrites prior run state in `.claude/state/workflow-run.json`. Clean slate per workflow attempt.
- **`terminalStep` controls cleanup**: only when terminal step reaches `done` does the run state file get deleted. Prevents orphaned state files. **Invariant: terminal step must have non-null `detectOn`, enforced by test.**
- **Advisory-only injection**: hook is fail-open on all paths (exit 0 always). Hard gates (`workflow-artifact-gate.cjs`) untouched. This hook adds context, never blocks.

## What We Tried

1. **Manifest registry vs convention scanning**: Initially considered central `manifest-registry.json`. Rejected — registry maintenance overhead. Went with glob-scan (`loadManifests()` reads `.claude/schemas/*-workflow-steps.json`). Cleaner, scales with new files, no single point of config.

2. **Step detection: hardcoded type checks vs regex on prompt**: Checked if subagent type name alone was enough. Found ambiguity: `/ck:plan` can spawn `planner` or `researcher`. Kept detection as regex on original prompt (`triggers` field in manifest), subagent type only used for auto-advance (`detectOn`).

3. **State cleanup on timeout vs active detection**: Considered auto-deleting run state after N minutes. Kept it simple: cleanup only on terminalStep completion. If a workflow gets stuck, state persists (user can manually delete `.claude/state/workflow-run.json` if needed). Advisory-only design makes this safe.

4. **`terminalStep` with `null` detectOn**: Nearly shipped without a guard. Code review (M1) caught it — test now asserts every manifest has `terminalStep` with non-null `detectOn`. Prevents silent state stranding.

## Root Cause Analysis

The generalization became necessary when planning step-tracking for `/ck:plan`, `/ck:fix`, `/ck:test` skills. The cook-specific hook was a bottleneck — adding a new workflow meant touching hook code. Manifests flip the cost: new workflow = new file (data), not code.

The overlooked invariant (terminal step must be auto-detectable) emerged during testing. If `terminalStep` points at a step with `detectOn: null`, nothing ever marks it done, run state never clears, workflow checklist injects forever. Test-driven catch.

## Lessons Learned

1. **Convention-scanning manifests scale better than central registries**: New skill files are discovered automatically. No hook rewrites, no registry updates. Reduces friction for adding tracked workflows to new skills.

2. **Self-describing manifests enable tooling**: `triggers`, `steps[].detectOn`, `terminalStep` — all queryable data. Future: CLI tools can list active workflows, show step progress, even auto-repair state. Wasn't built here, but structure enables it.

3. **`terminalStep` must be auto-detectable (invariant)**: If a step is the only thing that clears run state, it must have a way to auto-trigger (`detectOn != null`). Enforce at test time, not documentation time. Applied.

4. **Fail-open hook design enables opt-in adoption**: Hook doesn't block (exit 0 always), just injects context. Skills without manifests work unchanged. Low cost to roll out.

5. **`.claude/` local state requires user-aware cleanup**: No hook-based auto-deletion of workflow state (overengineering). If a workflow hangs, user can `rm .claude/state/workflow-run.json`. Simple, transparent, no surprise cleanup.

## Verification

- **Compile**: No errors in all hook + test files.
- **Tests**: 41/41 targeted skill-step-tracker + workflow-step-manager tests pass. Full `.claude/` suite: 730 pass, 11 pre-existing failures all unrelated (macOS `/private/var` realpath issues in ck-config-utils, session-init compact-warning, advisory-boundary-policy doc scans — Issue #277 tracked).
- **Code review**: DONE_WITH_CONCERNS. Applied M1 (terminalStep detectOn invariant test). No blockers, ship-ready.
- **Regressions**: None. Hook interface unchanged (still injects context on SubagentStart/SubagentStop), other hooks unaffected.
- **Local-only**: All changes under `.claude/` (gitignored). Plan: `plans/260617-1256-generalize-skill-step-tracker/`.

## Next Steps

1. Document manifest structure in `.claude/README.md` or inline hook comments (optional, post-ship if time permits).
2. If new skills need step tracking (e.g., `/ck:test`, `/ck:code-review`), drop a manifest file in `.claude/schemas/` — no hook edits.
3. Monitor: if workflow state files accumulate (user starts many tracked skills), consider optional CLI command for state cleanup.
4. Future enhancement: CLI commands to query active workflows, list steps, reset state (out of scope now).

---

**Status:** DONE  
**Summary:** Cook-step-tracker generalized to skill-agnostic manifest-driven engine. Convention-scanning `.claude/schemas/` for workflow manifests, zero hook edits per new skill, 41 tests passing, ship-ready. Local-only (`.claude/` gitignored).

## Unresolved Questions

- Should manifests support step grouping (e.g., "research" phase with 2–3 sub-steps)? (Not needed for plan/fix/cook; defer until requested)
- CLI tools for state inspection/cleanup? (UX polish, post-MVP)

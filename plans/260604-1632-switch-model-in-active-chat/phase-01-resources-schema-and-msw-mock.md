---
phase: 1
title: "Resources Schema and MSW Mock"
status: pending
priority: P2
effort: "2h"
dependencies: []
---

# Phase 1: Resources Schema and MSW Mock

## Overview

Define the Zod schema for the workspace resources response (providers + their models, role-filtered) and ship an MSW handler so the UI can build against it. Mirrors UC-015's response shape, restricted to the slice UC-021 needs (providers/models — templates deferred to UC-022).

## Requirements

- **Functional:** Provide `GET /api/workspaces/:workspaceId/resources` returning `{ providers: ProviderWithModels[] }` filtered by role (BR-084) and `isEnabled` (BR-053, BR-083).
- **Non-functional:** Zod parse at the boundary (NFR-021). No provider ciphertext in response (BR-050).

## Architecture

Two new files:
- `llm-ui/src/schemas/resources.ts` — Zod types for `Provider`, `Model`, `ProviderWithModels`, `WorkspaceResourcesResponse`.
- `llm-ui/src/mocks/fixtures/resources.ts` — fixture data keyed by `workspaceId`, each provider entry tagged with `allowedRoles: WorkspaceRole[]` to drive the MSW filter.
- `llm-ui/src/mocks/handlers/resources-handlers.ts` — handler that resolves the requesting user's role from `DEMO_WORKSPACES[workspaceId].role`, filters providers, and returns the response.

Wire the handler into `llm-ui/src/mocks/handlers/index.ts`.

Schema shape (proposed):

```ts
// llm-ui/src/schemas/resources.ts
import { z } from 'zod';
import { WorkspaceRole } from './workspace';

export const ProviderKind = z.enum(['openai', 'anthropic', 'google', 'azure-openai', 'custom']);

export const Model = z.object({
  id: z.string(),           // e.g. "gpt-4o-mini"
  displayName: z.string(),  // e.g. "GPT-4o Mini"
  contextWindow: z.number().int().positive().optional(),
});

export const Provider = z.object({
  id: z.string(),           // PROVIDER.id
  displayName: z.string(),
  providerKind: ProviderKind,
  isEnabled: z.boolean(),
  models: z.array(Model),
});

export const WorkspaceResourcesResponse = z.object({
  providers: z.array(Provider),
});
```

## Related Code Files

- Create: `llm-ui/src/schemas/resources.ts`
- Create: `llm-ui/src/mocks/fixtures/resources.ts`
- Create: `llm-ui/src/mocks/handlers/resources-handlers.ts`
- Modify: `llm-ui/src/mocks/handlers/index.ts` (register new handler)

## Implementation Steps

1. Create `schemas/resources.ts` with `ProviderKind`, `Model`, `Provider`, `WorkspaceResourcesResponse`.
2. Create `mocks/fixtures/resources.ts` exporting a `WORKSPACE_RESOURCES` map keyed by workspace id. Include at least:
   - `wsp_personal` (owner role): OpenAI (enabled, 2 models), Anthropic (enabled, 1 model), one disabled provider to verify it is filtered out.
   - `wsp_acme` (admin role): same providers + one provider whose `allowedRoles` excludes `member`/`viewer` to exercise BR-084.
3. Create `mocks/handlers/resources-handlers.ts`:
   - Handler `http.get('/api/workspaces/:workspaceId/resources', ...)`.
   - Look up the workspace in `DEMO_WORKSPACES`, read `.role`.
   - Filter providers: keep only `isEnabled === true` AND `allowedRoles.includes(role)`.
   - Strip the internal `allowedRoles` field before responding.
   - Add 150ms `delay()` to mirror `workspace-handlers.ts` pacing.
4. Register the handler in `mocks/handlers/index.ts`.
5. Run `pnpm --filter @ai-connect/ui typecheck`.

## Success Criteria

- [ ] `schemas/resources.ts` exports parseable Zod schemas; `WorkspaceResourcesResponse.parse(fixture)` succeeds.
- [ ] `GET /api/workspaces/wsp_personal/resources` (via dev MSW) returns enabled providers only, no `allowedRoles` leak.
- [ ] `GET /api/workspaces/wsp_acme/resources` for an admin role omits providers whose `allowedRoles` excludes `admin`.
- [ ] `pnpm --filter @ai-connect/ui typecheck` exits 0.

## Risk Assessment

- **Risk:** Inventing a contract before UC-015 backend ships. **Mitigation:** keep schema isolated; document mapping decisions in this phase so the swap is mechanical.
- **Risk:** Test fixtures growing into a maintenance burden. **Mitigation:** keep to ≤4 providers per workspace and one disabled + one role-restricted entry — just enough to exercise BR-053/BR-083/BR-084.

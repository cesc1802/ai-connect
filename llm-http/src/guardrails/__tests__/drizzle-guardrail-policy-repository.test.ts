import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDbClient,
  workspaceGuardrailPolicies,
  type DbClient,
} from "@ai-connect/db";
import { DrizzleGuardrailPolicyRepository } from "../drizzle-guardrail-policy-repository.js";
import { seedTestIdentity } from "../../conversations/__tests__/seed-test-identity.js";

// Dedicated identity so parallel cleanup never races other test files.
const WS = "00000000-0000-0000-0000-0000000000c1";
const USER_ID = "00000000-0000-0000-0000-0000000000c2";

// Live DB tests; skipped unless DATABASE_URL points at a migrated Postgres.
const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleGuardrailPolicyRepository", () => {
  let client: DbClient;
  let repo: DrizzleGuardrailPolicyRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    await seedTestIdentity(client, {
      workspaceId: WS,
      userId: USER_ID,
      slug: "guardrail-policy-test",
    });
    repo = new DrizzleGuardrailPolicyRepository(client);
  });

  afterEach(async () => {
    await client.db
      .delete(workspaceGuardrailPolicies)
      .where(eq(workspaceGuardrailPolicies.workspaceId, WS));
  });

  afterAll(async () => {
    await client.close();
  });

  it("absent row resolves to a disabled, empty policy", async () => {
    expect(await repo.get(WS)).toEqual({ enabled: false, checks: [] });
  });

  it("upsert then get round-trips the policy", async () => {
    const policy = {
      enabled: true,
      checks: [
        { kind: "pii" as const, enabled: true, action: "redact" as const },
        {
          kind: "blocklist" as const,
          enabled: true,
          action: "block" as const,
          options: { terms: ["secret"] },
        },
      ],
    };
    await repo.upsert(WS, policy);
    expect(await repo.get(WS)).toEqual(policy);
  });

  it("second upsert overwrites the existing row (no duplicate, last write wins)", async () => {
    await repo.upsert(WS, {
      enabled: true,
      checks: [{ kind: "pii" as const, enabled: true, action: "redact" as const }],
    });
    await repo.upsert(WS, { enabled: false, checks: [] });
    expect(await repo.get(WS)).toEqual({ enabled: false, checks: [] });
  });
});

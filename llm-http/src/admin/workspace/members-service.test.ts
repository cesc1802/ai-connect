import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuditEmitter, AuditEvent } from "@ai-connect/shared";
import {
  InMemoryWsMembersRepository,
  type WsMemberRow,
} from "./members-repo.js";
import {
  DefaultWsMembersService,
  DuplicateMemberError,
  LastAdminError,
  MemberNotFoundError,
} from "./members-service.js";
import type { Logger } from "../../logger.js";

const WS_ID = "demo-ws";
const ACTOR = "actor-admin";

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

function makeHarness(seed: WsMemberRow[]) {
  const emitted: AuditEvent[] = [];
  const emitter: AuditEmitter = {
    emit: vi.fn(async (event: AuditEvent) => {
      emitted.push(event);
    }),
  };
  const repo = new InMemoryWsMembersRepository(
    new Map([[WS_ID, seed]]),
  );
  const service = new DefaultWsMembersService(repo, emitter, makeLogger());
  return { repo, service, emitter, emitted };
}

const oneAdminSeed: WsMemberRow[] = [
  {
    id: "m-admin",
    email: "admin@demo.example",
    role: "admin",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "m-member",
    email: "member@demo.example",
    role: "member",
    joinedAt: "2026-02-01T00:00:00.000Z",
  },
];

const twoAdminSeed: WsMemberRow[] = [
  {
    id: "m-admin-1",
    email: "ada@demo.example",
    role: "admin",
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "m-admin-2",
    email: "grace@demo.example",
    role: "admin",
    joinedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "m-member",
    email: "alan@demo.example",
    role: "member",
    joinedAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("DefaultWsMembersService — BR-099 last-admin guard", () => {
  it("rejects removing the last admin with LastAdminError", async () => {
    const h = makeHarness(oneAdminSeed);
    await expect(
      h.service.remove(WS_ID, ACTOR, "m-admin"),
    ).rejects.toBeInstanceOf(LastAdminError);
    expect(await h.repo.findById(WS_ID, "m-admin")).toBeDefined();
  });

  it("rejects demoting the last admin to member with LastAdminError", async () => {
    const h = makeHarness(oneAdminSeed);
    await expect(
      h.service.changeRole(WS_ID, ACTOR, "m-admin", "member"),
    ).rejects.toBeInstanceOf(LastAdminError);
    const row = await h.repo.findById(WS_ID, "m-admin");
    expect(row?.role).toBe("admin");
  });

  it("allows removing one admin when two admins exist", async () => {
    const h = makeHarness(twoAdminSeed);
    const removed = await h.service.remove(WS_ID, ACTOR, "m-admin-1");
    expect(removed.id).toBe("m-admin-1");
    expect(await h.repo.countAdmins(WS_ID)).toBe(1);
  });

  it("allows demoting one of two admins", async () => {
    const h = makeHarness(twoAdminSeed);
    const after = await h.service.changeRole(
      WS_ID,
      ACTOR,
      "m-admin-1",
      "member",
    );
    expect(after.role).toBe("member");
    expect(await h.repo.countAdmins(WS_ID)).toBe(1);
  });
});

describe("DefaultWsMembersService — invite", () => {
  it("creates a row, returns it, and emits member.invited", async () => {
    const h = makeHarness(oneAdminSeed);
    const row = await h.service.invite(WS_ID, ACTOR, {
      email: "new@demo.example",
      role: "viewer",
    });
    expect(row).toMatchObject({
      email: "new@demo.example",
      role: "viewer",
    });
    expect(row.id).toBeTypeOf("string");

    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toMatchObject({
      action: "member.invited",
      actor: { userId: ACTOR, orgId: WS_ID },
      target: { kind: "user", id: row.id },
      after: { email: "new@demo.example", role: "viewer" },
    });
  });

  it("rejects duplicate email with DuplicateMemberError", async () => {
    const h = makeHarness(oneAdminSeed);
    await expect(
      h.service.invite(WS_ID, ACTOR, {
        email: "member@demo.example",
        role: "member",
      }),
    ).rejects.toBeInstanceOf(DuplicateMemberError);
  });
});

describe("DefaultWsMembersService — changeRole", () => {
  it("emits member.role_changed with before/after diff", async () => {
    const h = makeHarness(twoAdminSeed);
    await h.service.changeRole(WS_ID, ACTOR, "m-admin-1", "member");

    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toMatchObject({
      action: "member.role_changed",
      actor: { userId: ACTOR, orgId: WS_ID },
      target: { kind: "user", id: "m-admin-1" },
      before: { role: "admin" },
      after: { role: "member" },
    });
  });

  it("throws MemberNotFoundError for unknown id", async () => {
    const h = makeHarness(oneAdminSeed);
    await expect(
      h.service.changeRole(WS_ID, ACTOR, "missing", "viewer"),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it("is a no-op (no emit) when role is unchanged", async () => {
    const h = makeHarness(oneAdminSeed);
    const row = await h.service.changeRole(
      WS_ID,
      ACTOR,
      "m-member",
      "member",
    );
    expect(row.role).toBe("member");
    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted).toHaveLength(0);
  });
});

describe("DefaultWsMembersService — remove", () => {
  it("removes a member and emits member.removed with before snapshot", async () => {
    const h = makeHarness(oneAdminSeed);
    await h.service.remove(WS_ID, ACTOR, "m-member");

    expect(await h.repo.findById(WS_ID, "m-member")).toBeUndefined();
    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toMatchObject({
      action: "member.removed",
      actor: { userId: ACTOR, orgId: WS_ID },
      target: { kind: "user", id: "m-member" },
      before: { id: "m-member", role: "member" },
    });
  });

  it("throws MemberNotFoundError for unknown id", async () => {
    const h = makeHarness(oneAdminSeed);
    await expect(
      h.service.remove(WS_ID, ACTOR, "missing"),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});

describe("DefaultWsMembersService — list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rows sorted by joinedAt", async () => {
    const h = makeHarness(twoAdminSeed);
    const rows = await h.service.list(WS_ID);
    expect(rows.map((r) => r.id)).toEqual([
      "m-admin-1",
      "m-admin-2",
      "m-member",
    ]);
  });
});

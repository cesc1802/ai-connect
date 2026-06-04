import { http, HttpResponse, delay } from 'msw';
import type { WorkspaceRole } from '@/schemas/auth';

interface StoredRow {
  role: WorkspaceRole;
  maxRequests: number;
}

const seed: StoredRow[] = [
  { role: 'owner', maxRequests: 1000 },
  { role: 'admin', maxRequests: 500 },
  { role: 'member', maxRequests: 200 },
  { role: 'viewer', maxRequests: 50 },
];

let rows: StoredRow[] = seed.map((r) => ({ ...r }));
let usage: Map<WorkspaceRole, number> = new Map();

export function resetWsQuotasHandlers(): void {
  rows = seed.map((r) => ({ ...r }));
  usage = new Map();
}

export function setWsQuotaUsage(map: Partial<Record<WorkspaceRole, number>>): void {
  usage = new Map(
    Object.entries(map).map(([role, n]) => [role as WorkspaceRole, n as number]),
  );
}

function rowsWire() {
  return rows.map((r) => ({
    role: r.role,
    maxRequests: r.maxRequests,
    overCount: usage.get(r.role) ?? 0,
  }));
}

export const adminWsQuotasHandlers = [
  http.get('/api/admin/workspace/quotas', async () => {
    await delay(10);
    return HttpResponse.json({ rows: rowsWire() });
  }),

  http.patch('/api/admin/workspace/quotas', async ({ request }) => {
    const body = (await request.json()) as {
      rows?: Array<{ role?: unknown; maxRequests?: unknown }>;
      force?: boolean;
    };
    const incoming = Array.isArray(body.rows)
      ? body.rows
          .map((r) => ({
            role: r.role as WorkspaceRole,
            maxRequests: typeof r.maxRequests === 'number' ? r.maxRequests : 0,
          }))
          .filter((r) => !!r.role)
      : [];
    const force = body.force === true;

    const warnings = incoming
      .filter((r) => (usage.get(r.role) ?? 0) > r.maxRequests)
      .map((r) => ({ role: r.role, overCount: usage.get(r.role) ?? 0 }));

    if (warnings.length > 0 && !force) {
      return HttpResponse.json({ rows: rowsWire(), warnings });
    }

    const byRole = new Map(rows.map((r) => [r.role, r] as const));
    for (const r of incoming) {
      const existing = byRole.get(r.role);
      if (existing) existing.maxRequests = r.maxRequests;
      else {
        const fresh = { role: r.role, maxRequests: r.maxRequests };
        rows.push(fresh);
        byRole.set(r.role, fresh);
      }
    }
    return HttpResponse.json({ rows: rowsWire() });
  }),
];

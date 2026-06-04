import { http, HttpResponse, delay } from 'msw';
import type {
  WsAvailableTemplate,
  WsBoundTemplate,
} from '@/schemas/admin';
import type { WorkspaceRole } from '@/schemas/auth';

const seedPool: WsAvailableTemplate[] = [
  { templateId: 't-summary', name: 'Summarize' },
  { templateId: 't-translate', name: 'Translate' },
  { templateId: 't-extract', name: 'Extract entities' },
];

let pool: WsAvailableTemplate[] = [...seedPool];
let bound: WsBoundTemplate[] = [
  { templateId: 't-summary', name: 'Summarize', suggestedRole: 'member' },
];

function etag(items: WsBoundTemplate[]): string {
  const key = [...items]
    .map((b) => `${b.templateId}|${b.suggestedRole}`)
    .sort()
    .join(',');
  return `"ws-tpl-${key}"`;
}

export function resetWsTemplatesHandlers(): void {
  pool = [...seedPool];
  bound = [
    { templateId: 't-summary', name: 'Summarize', suggestedRole: 'member' },
  ];
}

export function setWsTemplatesPool(items: WsAvailableTemplate[]): void {
  pool = [...items];
}

export function setWsTemplatesBound(items: WsBoundTemplate[]): void {
  bound = [...items];
}

function snapshot() {
  const boundIds = new Set(bound.map((b) => b.templateId));
  const available = pool.filter((p) => !boundIds.has(p.templateId));
  return { available, bound };
}

export const adminWsTemplatesHandlers = [
  http.get('/api/admin/workspace/templates', async () => {
    await delay(30);
    return HttpResponse.json(snapshot(), {
      headers: { ETag: etag(bound) },
    });
  }),

  http.put('/api/admin/workspace/templates', async ({ request }) => {
    const body = (await request.json()) as { templates?: unknown };
    const pairs = Array.isArray(body.templates)
      ? (body.templates as Array<{
          templateId?: unknown;
          suggestedRole?: unknown;
        }>)
          .map((p) => ({
            templateId: typeof p.templateId === 'string' ? p.templateId : '',
            suggestedRole: p.suggestedRole as WorkspaceRole,
          }))
          .filter((p) => p.templateId)
      : [];
    const ifMatch = request.headers.get('If-Match');
    if (ifMatch !== null && ifMatch !== etag(bound)) {
      return HttpResponse.json(
        { error: 'etag_mismatch', message: 'Bindings changed' },
        { status: 409 },
      );
    }
    const poolIds = new Set(pool.map((p) => p.templateId));
    const invalidIds = pairs
      .map((p) => p.templateId)
      .filter((id) => !poolIds.has(id));
    if (invalidIds.length > 0) {
      return HttpResponse.json(
        { error: 'bad_request', code: 'not_in_org_pool', invalidIds },
        { status: 400 },
      );
    }
    bound = pairs.map((p) => ({
      templateId: p.templateId,
      name: pool.find((x) => x.templateId === p.templateId)?.name ?? p.templateId,
      suggestedRole: p.suggestedRole,
    }));
    return HttpResponse.json(snapshot(), {
      headers: { ETag: etag(bound) },
    });
  }),
];

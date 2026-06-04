import { http, HttpResponse, delay } from 'msw';
import type { WsProviderItem } from '@/schemas/admin';

const seedAvailable: WsProviderItem[] = [
  { id: 'p-openai', displayName: 'OpenAI prod', providerKind: 'openai' },
  { id: 'p-anthropic', displayName: 'Anthropic prod', providerKind: 'anthropic' },
  { id: 'p-azure', displayName: 'Azure prod', providerKind: 'azure-openai' },
];

let pool: WsProviderItem[] = [...seedAvailable];
let boundIds: string[] = ['p-openai'];

function etag(ids: string[]): string {
  return `"ws-prov-${[...ids].sort().join('|')}"`;
}

export function resetWsProvidersHandlers(): void {
  pool = [...seedAvailable];
  boundIds = ['p-openai'];
}

export function setWsProvidersPool(items: WsProviderItem[]): void {
  pool = [...items];
}

export function setWsProvidersBound(ids: string[]): void {
  boundIds = [...ids];
}

function snapshot() {
  const available = pool.filter((p) => !boundIds.includes(p.id));
  const bound = boundIds
    .map((id) => pool.find((p) => p.id === id))
    .filter((p): p is WsProviderItem => Boolean(p));
  return { available, bound };
}

export const adminWsProvidersHandlers = [
  http.get('/api/admin/workspace/providers', async () => {
    await delay(30);
    return HttpResponse.json(snapshot(), {
      headers: { ETag: etag(boundIds) },
    });
  }),

  http.put('/api/admin/workspace/providers', async ({ request }) => {
    const body = (await request.json()) as { providerIds?: unknown };
    const ids = Array.isArray(body.providerIds)
      ? (body.providerIds.filter((x) => typeof x === 'string') as string[])
      : [];
    const ifMatch = request.headers.get('If-Match');
    if (ifMatch !== null && ifMatch !== etag(boundIds)) {
      return HttpResponse.json(
        { error: 'etag_mismatch', message: 'Bindings changed' },
        { status: 409 },
      );
    }
    const poolIds = new Set(pool.map((p) => p.id));
    const invalidIds = ids.filter((id) => !poolIds.has(id));
    if (invalidIds.length > 0) {
      return HttpResponse.json(
        { error: 'bad_request', code: 'not_in_org_pool', invalidIds },
        { status: 400 },
      );
    }
    boundIds = [...ids];
    return HttpResponse.json(snapshot(), {
      headers: { ETag: etag(boundIds) },
    });
  }),
];

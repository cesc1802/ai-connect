import { http, HttpResponse, delay } from 'msw';
import type { OrgProviderRow } from '@/schemas/admin';

const seedProviders: OrgProviderRow[] = [
  {
    id: 'p-openai',
    displayName: 'OpenAI primary',
    providerKind: 'openai',
    isEnabled: true,
    hasKey: true,
    lastFour: '1234',
  },
  {
    id: 'p-anthropic',
    displayName: 'Anthropic prod',
    providerKind: 'anthropic',
    isEnabled: false,
    hasKey: true,
    lastFour: '5678',
  },
];

let providers: OrgProviderRow[] = [...seedProviders];

export function resetOrgProviderHandlers(): void {
  providers = [...seedProviders];
}

function lastFour(key: string): string {
  return key.slice(-4).padStart(4, '*');
}

export const adminOrgProvidersHandlers = [
  http.get('/api/admin/org/providers', async () => {
    await delay(20);
    return HttpResponse.json({ providers });
  }),

  http.post('/api/admin/org/providers', async ({ request }) => {
    const body = (await request.json()) as {
      displayName?: string;
      providerKind?: OrgProviderRow['providerKind'];
      apiKey?: string;
    };
    const displayName = (body.displayName ?? '').trim();
    const providerKind = body.providerKind;
    const apiKey = body.apiKey ?? '';
    if (!displayName || !providerKind || apiKey.length < 8) {
      return HttpResponse.json(
        { code: 'invalid_body', message: 'Invalid input' },
        { status: 400 },
      );
    }
    if (
      providers.some(
        (p) => p.displayName.toLowerCase() === displayName.toLowerCase(),
      )
    ) {
      return HttpResponse.json(
        {
          code: 'duplicate_name',
          message: 'Provider name already exists',
        },
        { status: 409 },
      );
    }
    const row: OrgProviderRow = {
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      displayName,
      providerKind,
      isEnabled: true,
      hasKey: true,
      lastFour: lastFour(apiKey),
    };
    providers = [...providers, row];
    return HttpResponse.json({ provider: row }, { status: 201 });
  }),

  http.patch('/api/admin/org/providers/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const idx = providers.findIndex((p) => p.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { code: 'provider_not_found', message: 'Not found' },
        { status: 404 },
      );
    }
    const patch = (await request.json()) as Partial<
      Pick<OrgProviderRow, 'displayName' | 'isEnabled'>
    >;
    const current = providers[idx]!;
    const updated: OrgProviderRow = {
      ...current,
      ...(typeof patch.displayName === 'string'
        ? { displayName: patch.displayName }
        : {}),
      ...(typeof patch.isEnabled === 'boolean'
        ? { isEnabled: patch.isEnabled }
        : {}),
    };
    providers = [...providers.slice(0, idx), updated, ...providers.slice(idx + 1)];
    return HttpResponse.json({ provider: updated });
  }),

  http.post(
    '/api/admin/org/providers/:id/rotate-key',
    async ({ params, request }) => {
      const { id } = params as { id: string };
      const idx = providers.findIndex((p) => p.id === id);
      if (idx === -1) {
        return HttpResponse.json(
          { code: 'provider_not_found', message: 'Not found' },
          { status: 404 },
        );
      }
      const body = (await request.json()) as { apiKey?: string };
      const apiKey = body.apiKey ?? '';
      if (apiKey.length < 8) {
        return HttpResponse.json(
          { code: 'invalid_body', message: 'API key too short' },
          { status: 400 },
        );
      }
      const current = providers[idx]!;
      const updated: OrgProviderRow = {
        ...current,
        hasKey: true,
        lastFour: lastFour(apiKey),
      };
      providers = [
        ...providers.slice(0, idx),
        updated,
        ...providers.slice(idx + 1),
      ];
      return HttpResponse.json({ provider: updated });
    },
  ),

  http.delete('/api/admin/org/providers/:id', async ({ params }) => {
    const { id } = params as { id: string };
    const before = providers.length;
    providers = providers.filter((p) => p.id !== id);
    if (providers.length === before) {
      return HttpResponse.json(
        { code: 'provider_not_found', message: 'Not found' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

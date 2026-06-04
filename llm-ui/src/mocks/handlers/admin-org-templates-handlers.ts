import { http, HttpResponse } from 'msw';
import type { OrgTemplateRow } from '@/schemas/admin';

interface Store {
  rows: OrgTemplateRow[];
  failNextDelete: boolean;
}

export function makeOrgTemplatesStore(initial: OrgTemplateRow[] = []): Store {
  return { rows: [...initial], failNextDelete: false };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `tpl_msw_${idCounter}`;
}

export function makeOrgTemplatesHandlers(store: Store) {
  return [
    http.get('/api/admin/org/templates', () => {
      return HttpResponse.json({ templates: store.rows });
    }),

    http.post('/api/admin/org/templates', async ({ request }) => {
      const body = (await request.json()) as {
        name: string;
        description?: string;
        body: string;
        tags: string[];
      };
      const exists = store.rows.find(
        (r) => r.name.toLowerCase() === body.name.toLowerCase(),
      );
      if (exists) {
        return HttpResponse.json(
          { code: 'template_name_conflict' },
          { status: 409 },
        );
      }
      const row: OrgTemplateRow = {
        id: nextId(),
        name: body.name,
        description: body.description,
        body: body.body,
        tags: body.tags,
        updatedAt: new Date().toISOString(),
      };
      store.rows.push(row);
      return HttpResponse.json(row, { status: 201 });
    }),

    http.patch('/api/admin/org/templates/:id', async ({ params, request }) => {
      const { id } = params as { id: string };
      const patch = (await request.json()) as Partial<OrgTemplateRow>;
      const idx = store.rows.findIndex((r) => r.id === id);
      if (idx === -1) {
        return HttpResponse.json({ code: 'not_found' }, { status: 404 });
      }
      if (
        patch.name &&
        store.rows.some(
          (r) =>
            r.id !== id &&
            r.name.toLowerCase() === patch.name!.toLowerCase(),
        )
      ) {
        return HttpResponse.json(
          { code: 'template_name_conflict' },
          { status: 409 },
        );
      }
      const next: OrgTemplateRow = {
        ...store.rows[idx]!,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      store.rows[idx] = next;
      return HttpResponse.json(next);
    }),

    http.delete('/api/admin/org/templates/:id', ({ params }) => {
      const { id } = params as { id: string };
      if (store.failNextDelete) {
        store.failNextDelete = false;
        return HttpResponse.json({ code: 'internal_error' }, { status: 500 });
      }
      const idx = store.rows.findIndex((r) => r.id === id);
      if (idx === -1) {
        return HttpResponse.json({ code: 'not_found' }, { status: 404 });
      }
      store.rows.splice(idx, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

const defaultStore = makeOrgTemplatesStore();
export const orgTemplatesHandlers = makeOrgTemplatesHandlers(defaultStore);

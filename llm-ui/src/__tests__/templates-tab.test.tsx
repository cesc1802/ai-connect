import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { TemplatesTab } from '@/components/admin/org/templates-tab';
import { TemplateFormDialog } from '@/components/admin/org/template-form-dialog';
import { server } from '@/mocks/server';
import {
  makeOrgTemplatesHandlers,
  makeOrgTemplatesStore,
} from '@/mocks/handlers/admin-org-templates-handlers';
import type { OrgTemplateRow } from '@/schemas/admin';

function makeRow(over: Partial<OrgTemplateRow> = {}): OrgTemplateRow {
  return {
    id: 'tpl_1',
    name: 'Summarize',
    description: 'Generic summary template',
    body: 'You are a helpful assistant. Summarize: {input}',
    tags: ['chat', 'summary'],
    updatedAt: '2026-05-01T12:00:00.000Z',
    ...over,
  };
}

function renderTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, ...render(<TemplatesTab />, { wrapper: Wrapper }) };
}

async function expectAxeClean(container: HTMLElement) {
  const results = await axe(container);
  const serious = (results.violations ?? []).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

describe('TemplatesTab', () => {
  beforeEach(() => {
    const store = makeOrgTemplatesStore([
      makeRow(),
      makeRow({
        id: 'tpl_2',
        name: 'Translate',
        description: 'Translate to target language',
        body: 'Translate {input} to {lang}',
        tags: ['chat', 'translate'],
        updatedAt: '2026-05-02T08:00:00.000Z',
      }),
    ]);
    server.use(...makeOrgTemplatesHandlers(store));
  });

  it('renders rows from the API', async () => {
    renderTab();
    expect(await screen.findByText('Summarize')).toBeInTheDocument();
    expect(screen.getByText('Translate')).toBeInTheDocument();
  });

  it('client-side filter narrows rows after debounce, clear restores', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Summarize');

    const search = screen.getByLabelText('Search templates');
    await user.type(search, 'translate');

    await waitFor(
      () => {
        expect(screen.queryByText('Summarize')).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    expect(screen.getByText('Translate')).toBeInTheDocument();

    await user.clear(search);
    await waitFor(() => {
      expect(screen.getByText('Summarize')).toBeInTheDocument();
    });
  });

  it('filter-empty state offers a Clear filter CTA', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Summarize');

    const search = screen.getByLabelText('Search templates');
    await user.type(search, 'nope-no-match');

    const heading = await screen.findByText(/No templates match "nope-no-match"/);
    expect(heading).toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: 'Clear filter' });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('Summarize')).toBeInTheDocument();
    });
  });

  it('shows "Create template" CTA when org has no templates', async () => {
    server.use(
      ...makeOrgTemplatesHandlers(makeOrgTemplatesStore([])),
    );
    renderTab();
    expect(
      await screen.findByRole('heading', { name: 'No templates yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Create template' }).length,
    ).toBeGreaterThan(0);
  });

  it('optimistically removes a row on delete and restores on server failure', async () => {
    const user = userEvent.setup();
    const failingStore = makeOrgTemplatesStore([makeRow({ id: 'tpl_x', name: 'Doomed' })]);
    failingStore.failNextDelete = true;
    server.use(...makeOrgTemplatesHandlers(failingStore));

    renderTab();
    await screen.findByText('Doomed');

    const row = screen.getByText('Doomed').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const confirmHeading = await screen.findByText('Delete template?');
    const dialog = confirmHeading.closest(
      '[data-slot="delete-template-confirm"]',
    ) as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(
      () => {
        expect(screen.getByText('Doomed')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('is axe-clean in light theme', async () => {
    const { container } = renderTab();
    await screen.findByText('Summarize');
    await expectAxeClean(container);
  });

  it('is axe-clean in dark theme', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { container } = render(
      <div className="dark">
        <QueryClientProvider client={qc}>
          <TemplatesTab />
        </QueryClientProvider>
      </div>,
    );
    await screen.findByText('Summarize');
    await expectAxeClean(container);
  });
});

describe('TemplateFormDialog', () => {
  it('rejects invalid tag with inline error and accepts valid tags as chips', async () => {
    const user = userEvent.setup();
    render(
      <TemplateFormDialog
        open
        onOpenChange={() => {}}
        mode="add"
        onSubmit={async () => {}}
      />,
    );

    const tagsInput = screen.getByLabelText('Tags');
    await user.type(tagsInput, 'Bad Tag,');
    expect(
      screen.getByText(/Invalid tag "bad tag"/i),
    ).toBeInTheDocument();

    await user.clear(tagsInput);
    await user.type(tagsInput, 'chat,summary,');

    const list = screen.getByRole('list');
    expect(within(list).getByText('chat')).toBeInTheDocument();
    expect(within(list).getByText('summary')).toBeInTheDocument();
  });

  it('hydrates defaults in edit mode and calls onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TemplateFormDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        initialRow={{
          id: 'tpl_1',
          name: 'Alpha',
          description: 'desc',
          body: 'hello',
          tags: ['chat'],
          updatedAt: new Date().toISOString(),
        }}
        onSubmit={onSubmit}
      />,
    );

    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toBe('Alpha');
    const body = screen.getByLabelText('Body') as HTMLTextAreaElement;
    expect(body.value).toBe('hello');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alpha',
          body: 'hello',
          tags: ['chat'],
        }),
      ),
    );
  });

  it('is axe-clean in both themes', async () => {
    const { container, unmount } = render(
      <TemplateFormDialog
        open
        onOpenChange={() => {}}
        mode="add"
        onSubmit={async () => {}}
      />,
    );
    await expectAxeClean(container);
    unmount();

    const dark = render(
      <div className="dark">
        <TemplateFormDialog
          open
          onOpenChange={() => {}}
          mode="add"
          onSubmit={async () => {}}
        />
      </div>,
    );
    await expectAxeClean(dark.container);
  });
});


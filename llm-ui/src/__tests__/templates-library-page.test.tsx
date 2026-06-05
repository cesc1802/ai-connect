import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { TemplatesLibraryPage } from '@/pages/templates-library-page';
import { server } from '@/mocks/server';
import {
  makeOrgTemplatesHandlers,
  makeOrgTemplatesStore,
} from '@/mocks/handlers/admin-org-templates-handlers';
import type { OrgTemplateRow } from '@/schemas/admin';

function makeRow(over: Partial<OrgTemplateRow> = {}): OrgTemplateRow {
  return {
    id: 'tpl_a',
    name: 'Tóm tắt Standup',
    description: 'Tóm tắt nhanh cuộc họp standup.',
    body: 'Bạn là trợ lý. Hãy tóm tắt: {input}',
    tags: ['pm', 'summary'],
    updatedAt: '2026-05-01T12:00:00.000Z',
    ...over,
  };
}

const ROWS: OrgTemplateRow[] = [
  makeRow(),
  makeRow({
    id: 'tpl_b',
    name: 'Review Pull Request',
    description: 'Phân tích diff, gắn cờ rủi ro bảo mật.',
    tags: ['engineering', 'review'],
    updatedAt: '2026-05-02T08:00:00.000Z',
  }),
  makeRow({
    id: 'tpl_c',
    name: 'Sinh User Story',
    description: 'Chuyển yêu cầu thô thành user story.',
    tags: ['ba'],
    updatedAt: '2026-05-03T09:00:00.000Z',
  }),
];

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, ...render(<TemplatesLibraryPage />, { wrapper: Wrapper }) };
}

describe('TemplatesLibraryPage', () => {
  beforeEach(() => {
    server.use(...makeOrgTemplatesHandlers(makeOrgTemplatesStore([...ROWS])));
  });

  it('renders Vietnamese header verbatim from the mockup', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: 'Thư viện Prompt Template',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '50 mẫu prompt dùng chung toàn tổ chức — ai cũng có thể duyệt và sao chép vào agent của mình.',
      ),
    ).toBeInTheDocument();
  });

  it('renders one card per template returned by the API', async () => {
    renderPage();
    expect(await screen.findByText('Tóm tắt Standup')).toBeInTheDocument();
    expect(screen.getByText('Review Pull Request')).toBeInTheDocument();
    expect(screen.getByText('Sinh User Story')).toBeInTheDocument();
    expect(screen.getByText('Hiển thị 3 / 3 template')).toBeInTheDocument();
  });

  it('narrows results by tag chip and resets via "Tất cả"', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tóm tắt Standup');

    const engineeringChip = screen.getByRole('button', { name: /engineering/ });
    await user.click(engineeringChip);

    await waitFor(() => {
      expect(screen.queryByText('Tóm tắt Standup')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Review Pull Request')).toBeInTheDocument();
    expect(screen.getByText('Hiển thị 1 / 3 template')).toBeInTheDocument();

    const allChip = screen.getByRole('button', { name: /Tất cả/ });
    await user.click(allChip);
    await waitFor(() => {
      expect(screen.getByText('Tóm tắt Standup')).toBeInTheDocument();
    });
  });

  it('search input narrows by name or description (debounced)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tóm tắt Standup');

    const search = screen.getByLabelText('Tìm template');
    await user.type(search, 'diff');

    await waitFor(
      () => {
        expect(screen.queryByText('Tóm tắt Standup')).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    expect(screen.getByText('Review Pull Request')).toBeInTheDocument();
  });

  it('shows the empty-filter copy when nothing matches', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tóm tắt Standup');

    const search = screen.getByLabelText('Tìm template');
    await user.type(search, 'không-tồn-tại');

    expect(
      await screen.findByText('Không có template phù hợp.'),
    ).toBeInTheDocument();
  });

  it('shows the all-empty state with a primary CTA when the org has no templates', async () => {
    server.use(...makeOrgTemplatesHandlers(makeOrgTemplatesStore([])));
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Chưa có template nào' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Tạo template' }).length,
    ).toBeGreaterThan(0);
  });

  it('opens the create dialog when "Tạo template" is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Tóm tắt Standup');

    const cta = screen.getByRole('button', { name: 'Tạo template' });
    await user.click(cta);

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Add template' }),
    ).toBeInTheDocument();
  });
});

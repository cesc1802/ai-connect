import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { TemplateCard } from '@/components/rbac/templates/template-card';
import type { OrgTemplateRow } from '@/schemas/admin';

const ROW: OrgTemplateRow = {
  id: 'tpl_1',
  name: 'Tóm tắt Standup',
  description: 'Tóm tắt nhanh cuộc họp standup mỗi sáng.',
  body: 'Bạn là trợ lý. Hãy tóm tắt: {input}',
  tags: ['pm', 'summary'],
  updatedAt: '2026-05-01T12:00:00.000Z',
};

describe('TemplateCard', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, clipboard: { writeText } },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('renders name, description, tag chips, and an updated date', () => {
    render(
      <TemplateCard row={ROW} onEdit={() => {}} onDelete={() => {}} />,
    );
    expect(screen.getByText('Tóm tắt Standup')).toBeInTheDocument();
    expect(
      screen.getByText('Tóm tắt nhanh cuộc họp standup mỗi sáng.'),
    ).toBeInTheDocument();
    expect(screen.getByText('pm')).toBeInTheDocument();
    expect(screen.getByText('summary')).toBeInTheDocument();
    expect(screen.getByRole('time')).toHaveAttribute(
      'datetime',
      '2026-05-01T12:00:00.000Z',
    );
  });

  it('writes template body to clipboard when "Sao chép" is clicked', async () => {
    render(
      <TemplateCard row={ROW} onEdit={() => {}} onDelete={() => {}} />,
    );
    const copyBtn = screen.getByRole('button', {
      name: /Sao chép template Tóm tắt Standup/,
    });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(ROW.body);
    });
  });

  it('invokes onEdit and onDelete when their buttons are pressed', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TemplateCard row={ROW} onEdit={onEdit} onDelete={onDelete} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Sửa template Tóm tắt Standup/ }),
    );
    expect(onEdit).toHaveBeenCalledWith(ROW);

    fireEvent.click(
      screen.getByRole('button', { name: /Xoá template Tóm tắt Standup/ }),
    );
    expect(onDelete).toHaveBeenCalledWith(ROW);
  });
});

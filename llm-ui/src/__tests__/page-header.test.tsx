import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PageHeader } from '@/components/layout/page-header';

describe('PageHeader', () => {
  it('renders the title as an h1 with subtitle', () => {
    render(<PageHeader title="Tổng quan" subtitle="Organisation overview" />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Tổng quan' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('Organisation overview')).toBeInTheDocument();
  });

  it('renders eyebrow and actions when provided', () => {
    render(
      <PageHeader
        title="Workspaces"
        eyebrow="Org"
        actions={<button>New workspace</button>}
      />,
    );
    expect(screen.getByText('Org')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New workspace' }),
    ).toBeInTheDocument();
  });

  it('labels the header with the heading id', () => {
    render(<PageHeader title="Members" headingId="members-h1" />);
    const header = document.querySelector(
      'header[data-slot="page-header"]',
    ) as HTMLElement | null;
    expect(header).not.toBeNull();
    expect(header?.getAttribute('aria-labelledby')).toBe('members-h1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute(
      'id',
      'members-h1',
    );
  });
});

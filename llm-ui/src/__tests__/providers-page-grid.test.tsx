import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProviderGrid } from '@/components/rbac/providers/provider-grid';
import type { OrgProviderRow } from '@/schemas/admin';

const providers: OrgProviderRow[] = [
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

describe('ProviderGrid', () => {
  it('renders a card per provider plus a "Thêm provider" CTA card', () => {
    render(
      <ProviderGrid
        providers={providers}
        onAddProvider={() => {}}
        onRotateKey={() => {}}
        onToggleEnabled={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(document.querySelectorAll('[data-slot="provider-card"]').length).toBe(
      providers.length,
    );
    expect(
      screen.getByRole('button', { name: /Thêm provider/ }),
    ).toBeInTheDocument();
  });

  it('invokes onAddProvider when CTA card is clicked', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <ProviderGrid
        providers={providers}
        onAddProvider={onAdd}
        onRotateKey={() => {}}
        onToggleEnabled={() => {}}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByTestId('provider-grid-add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProviderCard } from '@/components/rbac/providers/provider-card';
import type { OrgProviderRow } from '@/schemas/admin';

const enabledProvider: OrgProviderRow = {
  id: 'p-openai',
  displayName: 'OpenAI primary',
  providerKind: 'openai',
  isEnabled: true,
  hasKey: true,
  lastFour: '1234',
};

const disabledProvider: OrgProviderRow = {
  id: 'p-anthropic',
  displayName: 'Anthropic prod',
  providerKind: 'anthropic',
  isEnabled: false,
  hasKey: true,
  lastFour: '5678',
};

function renderCard(provider: OrgProviderRow) {
  const handlers = {
    onRotateKey: vi.fn(),
    onToggleEnabled: vi.fn(),
    onDelete: vi.fn(),
  };
  return {
    handlers,
    ...render(<ProviderCard provider={provider} {...handlers} />),
  };
}

describe('ProviderCard', () => {
  it('renders provider name, kind, masked key, and enabled status badge', () => {
    renderCard(enabledProvider);
    expect(screen.getByText('OpenAI primary')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('••••1234')).toBeInTheDocument();
    expect(screen.getByText('Đang bật')).toBeInTheDocument();
  });

  it('renders disabled status pill when provider is not enabled', () => {
    renderCard(disabledProvider);
    expect(screen.getByText('Đang tắt')).toBeInTheDocument();
  });

  it('opens actions menu with Đổi key / Tắt / Xoá items when enabled', async () => {
    const user = userEvent.setup();
    renderCard(enabledProvider);
    await user.click(
      screen.getByRole('button', { name: /Hành động cho OpenAI primary/ }),
    );
    expect(
      await screen.findByRole('menuitem', { name: 'Đổi key' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Tắt' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Xoá' })).toBeInTheDocument();
  });

  it('shows "Bật" instead of "Tắt" when provider is disabled', async () => {
    const user = userEvent.setup();
    renderCard(disabledProvider);
    await user.click(
      screen.getByRole('button', { name: /Hành động cho Anthropic prod/ }),
    );
    expect(
      await screen.findByRole('menuitem', { name: 'Bật' }),
    ).toBeInTheDocument();
  });

  it('invokes onRotateKey handler when "Đổi key" is selected', async () => {
    const user = userEvent.setup();
    const { handlers } = renderCard(enabledProvider);
    await user.click(
      screen.getByRole('button', { name: /Hành động cho OpenAI primary/ }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Đổi key' }));
    expect(handlers.onRotateKey).toHaveBeenCalledWith(enabledProvider);
  });
});

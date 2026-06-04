import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import { AddProviderDialog } from '@/components/admin/org/add-provider-dialog';

async function expectNoSeriousAxe(container: HTMLElement) {
  const results = await axe(container);
  const serious = (results.violations ?? []).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

describe('AddProviderDialog — input hygiene', () => {
  it('uses password input with autocomplete off and spellcheck disabled', () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <AddProviderDialog open onOpenChange={() => {}} onAdd={onAdd} />,
    );

    const apiKey = screen.getByLabelText('API key') as HTMLInputElement;
    expect(apiKey.type).toBe('password');
    expect(apiKey.autocomplete).toBe('off');
    expect(apiKey.getAttribute('spellcheck')).toBe('false');
    expect(apiKey.hasAttribute('data-1p-ignore')).toBe(true);
  });

  it('is axe-clean when open', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AddProviderDialog open onOpenChange={() => {}} onAdd={onAdd} />,
    );
    await expectNoSeriousAxe(container);
  });
});

describe('AddProviderDialog — apiKey lifecycle (BR-094)', () => {
  it('resets the apiKey field BEFORE closing and leaves no plaintext in DOM', async () => {
    const user = userEvent.setup();
    const SECRET = 'sk-test-12345678';
    let resolveAdd: () => void = () => {};
    const addPromise = new Promise<void>((res) => {
      resolveAdd = res;
    });
    const onAdd = vi.fn().mockReturnValue(addPromise);
    const onOpenChange = vi.fn();

    const { container } = render(
      <AddProviderDialog open onOpenChange={onOpenChange} onAdd={onAdd} />,
    );

    await user.type(screen.getByLabelText('Display name'), 'OpenAI prod');
    await user.type(screen.getByLabelText('API key'), SECRET);
    await user.click(screen.getByRole('button', { name: 'Add provider' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0]![0]).toMatchObject({ apiKey: SECRET });

    resolveAdd();

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    const apiKey = screen.getByLabelText('API key') as HTMLInputElement;
    expect(apiKey.value).toBe('');

    expect(container.innerHTML).not.toContain(SECRET);
    expect(container.innerHTML).not.toContain('sk-test');
  });

  it('does not close the dialog and surfaces an error when the server fails', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockRejectedValue(new Error('network'));
    const onOpenChange = vi.fn();

    render(<AddProviderDialog open onOpenChange={onOpenChange} onAdd={onAdd} />);

    await user.type(screen.getByLabelText('Display name'), 'OpenAI prod');
    await user.type(screen.getByLabelText('API key'), 'sk-test-12345678');
    await user.click(screen.getByRole('button', { name: 'Add provider' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /could not add provider/i,
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

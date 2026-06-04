import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';

import { FormDialog } from '@/components/admin/form-dialog';

const schema = z.object({
  label: z.string().min(1, 'Label is required'),
  apiKey: z.string().min(1, 'API key is required'),
});
type Values = z.infer<typeof schema>;

const fields = [
  { name: 'label' as const, label: 'Label' },
  { name: 'apiKey' as const, label: 'API key', secret: true },
];

describe('FormDialog', () => {
  it('applies password + autoComplete=off + spellCheck=false to secret fields', () => {
    render(
      <FormDialog<typeof schema>
        open
        onOpenChange={() => {}}
        title="Add provider"
        schema={schema}
        fields={fields}
        defaultValues={{ label: '', apiKey: '' } as Values}
        onSubmit={async () => {}}
      />,
    );
    const apiKey = screen.getByLabelText('API key') as HTMLInputElement;
    expect(apiKey.type).toBe('password');
    expect(apiKey.getAttribute('autocomplete')).toBe('off');
    expect(apiKey.getAttribute('spellcheck')).toBe('false');
    const label = screen.getByLabelText('Label') as HTMLInputElement;
    expect(label.type).toBe('text');
  });

  it('sets aria-invalid and aria-describedby on validation error', async () => {
    const user = userEvent.setup();
    render(
      <FormDialog<typeof schema>
        open
        onOpenChange={() => {}}
        title="Add provider"
        schema={schema}
        fields={fields}
        defaultValues={{ label: '', apiKey: '' } as Values}
        onSubmit={async () => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const label = screen.getByLabelText('Label');
      expect(label).toHaveAttribute('aria-invalid', 'true');
      const describedBy = label.getAttribute('aria-describedby') ?? '';
      const errId = describedBy.split(/\s+/).find((id) => id);
      expect(errId).toBeTruthy();
      expect(document.getElementById(errId as string)).toHaveTextContent(
        'Label is required',
      );
    });
  });

  it('invokes onSubmit with validated values and closes', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <FormDialog<typeof schema>
        open
        onOpenChange={onOpenChange}
        title="Add provider"
        schema={schema}
        fields={fields}
        defaultValues={{ label: '', apiKey: '' } as Values}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText('Label'), 'OpenAI');
    await user.type(screen.getByLabelText('API key'), 'sk-abc');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        label: 'OpenAI',
        apiKey: 'sk-abc',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

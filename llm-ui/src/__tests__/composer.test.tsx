import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from '@/components/chat/composer';

describe('Composer', () => {
  it('submits on Enter and clears the textarea', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'hello world');
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('hello world');
    expect(textarea.value).toBe('');
  });

  it('inserts a newline on Shift+Enter without submitting', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'line1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'line2');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe('line1\nline2');
  });

  it('disables send when text is empty or only whitespace', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} />);

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).toBeDisabled();

    await user.type(screen.getByRole('textbox'), '   ');
    expect(sendBtn).toBeDisabled();
  });

  it('respects the disabled prop (e.g. WS not open)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Composer onSubmit={onSubmit} disabled />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
    // userEvent.type on a disabled textarea is a no-op; press Enter directly
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

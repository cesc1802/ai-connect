import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { useThemeStore } from '@/stores/theme-store';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ theme: 'system' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the toggle button with accessible label', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('opens the menu with all three theme options', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(await screen.findByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('updates the store when an option is selected', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    await user.click(await screen.findByText('Dark'));
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import { AdminTabs } from '@/components/admin/admin-tabs';

const ITEMS = [
  { value: 'a', label: 'Alpha', content: <p>alpha panel</p> },
  { value: 'b', label: 'Bravo', content: <p>bravo panel</p> },
  { value: 'c', label: 'Charlie', content: <p>charlie panel</p> },
];

function renderTabs() {
  return render(
    <AdminTabs ariaLabel="Test tabs" defaultValue="a" items={ITEMS} />,
  );
}

describe('AdminTabs (desktop)', () => {
  it('renders a tablist with the configured tabs', () => {
    renderTabs();
    const tablist = screen.getByRole('tablist', { name: 'Test tabs' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('activates the default tab and only renders its panel content', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('alpha panel')).toBeVisible();
  });

  it('ArrowRight rotates focus to the next tab without activating it', async () => {
    const user = userEvent.setup();
    renderTabs();
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    alpha.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveFocus();
  });

  it('ArrowLeft wraps from the first tab back to the last', async () => {
    const user = userEvent.setup();
    renderTabs();
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    alpha.focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveFocus();
  });

  it('Home jumps focus to the first tab and End to the last', async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('tab', { name: 'Bravo' }).focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveFocus();
  });

  it('Enter activates the focused tab', async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole('tab', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('bravo panel')).toBeVisible();
  });

  it('removes inactive tabs from the Tab key sequence (roving tabindex)', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    const inactive = tabs.filter(
      (t) => t.getAttribute('aria-selected') !== 'true',
    );
    for (const i of inactive) expect(i).toHaveAttribute('tabindex', '-1');
  });

  it('has zero serious/critical a11y violations in light theme', async () => {
    const { container } = renderTabs();
    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });

  it('has zero serious/critical a11y violations in dark theme', async () => {
    const { container } = render(
      <div className="dark">
        <AdminTabs ariaLabel="Test tabs" defaultValue="a" items={ITEMS} />
      </div>,
    );
    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});

describe('AdminTabs (mobile <select> fallback)', () => {
  function renderMobile() {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const result = render(
      <AdminTabs
        ariaLabel="Test tabs"
        defaultValue="a"
        items={ITEMS}
        mobileSelectLabel="Choose section"
      />,
    );
    return {
      ...result,
      restore: () => {
        window.matchMedia = original;
      },
    };
  }

  it('renders a labeled native <select> in place of the tablist', () => {
    const { restore } = renderMobile();
    try {
      const select = screen.getByLabelText('Choose section');
      expect(select.tagName).toBe('SELECT');
      expect(screen.queryByRole('tablist')).toBeNull();
    } finally {
      restore();
    }
  });

  it('changing the select activates the matching panel', async () => {
    const user = userEvent.setup();
    const { restore } = renderMobile();
    try {
      const select = screen.getByLabelText('Choose section') as HTMLSelectElement;
      await user.selectOptions(select, 'b');
      expect(screen.getByText('bravo panel')).toBeVisible();
    } finally {
      restore();
    }
  });

  it('has zero serious/critical a11y violations on mobile', async () => {
    const { container, restore } = renderMobile();
    try {
      const results = await axe(container);
      const serious = (results.violations ?? []).filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(serious).toEqual([]);
    } finally {
      restore();
    }
  });
});

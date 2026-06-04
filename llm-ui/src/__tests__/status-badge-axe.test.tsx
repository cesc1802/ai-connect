import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import {
  StatusBadge,
  type StatusIntent,
} from '@/components/admin/status-badge';

const INTENTS: StatusIntent[] = [
  'active',
  'pending',
  'warning',
  'disabled',
  'destructive',
  'info',
];

function Gallery() {
  return (
    <div>
      {INTENTS.map((intent) => (
        <StatusBadge key={intent} intent={intent}>
          {intent}
        </StatusBadge>
      ))}
    </div>
  );
}

async function expectNoSeriousAxe(container: HTMLElement) {
  const results = await axe(container);
  const serious = (results.violations ?? []).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

describe('StatusBadge', () => {
  it.each(INTENTS)('renders %s with icon and text label', (intent) => {
    const { container, getByText } = render(
      <StatusBadge intent={intent}>{intent}</StatusBadge>,
    );
    expect(getByText(intent)).toBeInTheDocument();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not encode state in opacity-tinted classes', () => {
    const { container } = render(<Gallery />);
    const badges = container.querySelectorAll('[data-slot="status-badge"]');
    for (const badge of badges) {
      const cls = badge.className;
      expect(cls).not.toMatch(/bg-[a-z]+\/(?:\d{1,3})/);
    }
  });

  it('is axe-clean in the light theme', async () => {
    const { container } = render(<Gallery />);
    await expectNoSeriousAxe(container);
  });

  it('is axe-clean in the dark theme', async () => {
    const { container } = render(
      <div className="dark">
        <Gallery />
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});

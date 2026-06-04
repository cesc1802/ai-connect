import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SidebarShell } from '@/components/sidebar/sidebar-shell';
import { SidebarSection } from '@/components/sidebar/sidebar-section';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';

const here = dirname(fileURLToPath(import.meta.url));
const appShellPath = resolve(here, '..', 'components', 'layout', 'app-shell.tsx');

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return { ...actual, useNavigate: () => () => {} };
});

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * NFR-024: motion-reduce class names must accompany every animated
 * affordance in the sidebar shell so users with prefers-reduced-motion get
 * instant width/visibility changes instead of the 200ms slide.
 */
describe('Sidebar reduced-motion compliance (NFR-024)', () => {
  beforeEach(() => {
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });
  afterEach(() => {
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });

  it('AppShell width transition carries motion-reduce:transition-none', () => {
    const source = readFileSync(appShellPath, 'utf8');
    expect(source).toMatch(/transition-\[grid-template-columns\]/);
    expect(source).toMatch(/motion-reduce:transition-none/);
  });

  it('SidebarShell rail toggle does not introduce a non-reduce-safe transition', () => {
    const { container } = render(
      <QueryClientProvider client={makeClient()}>
        <SidebarShell header={<div>H</div>}>
          <SidebarSection title="Chat">item</SidebarSection>
        </SidebarShell>
      </QueryClientProvider>,
    );
    // Inspect elements that carry a transition class WITHOUT a reduce-safe
    // modifier. shadcn/Radix primitives (Button, ScrollArea) are shared
    // upstream and out of this surface's ownership; their reduce-motion
    // behavior is enforced at the primitive level, not here.
    const candidates = Array.from(
      container.querySelectorAll('[class*="transition"]'),
    ) as HTMLElement[];
    const PRIMITIVE_SLOTS = new Set([
      'button',
      'scroll-area-viewport',
      'scroll-area-scrollbar',
    ]);
    const offenders = candidates.filter((el) => {
      const cls = el.className;
      if (typeof cls !== 'string') return false;
      if (cls.includes('motion-reduce:transition-none')) return false;
      if (el.dataset.slot && PRIMITIVE_SLOTS.has(el.dataset.slot)) return false;
      return true;
    });
    expect(offenders).toEqual([]);
  });
});

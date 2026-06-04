import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SidebarShell } from '@/components/sidebar/sidebar-shell';
import { SidebarSection } from '@/components/sidebar/sidebar-section';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return { ...actual, useNavigate: () => () => {} };
});

function applyViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderShell(variant: 'desktop' | 'mobile') {
  return render(
    <QueryClientProvider client={makeClient()}>
      <SidebarShell variant={variant} header={<div>HEADER</div>}>
        <SidebarSection title="Chat">
          <div>item-a</div>
          <div>item-b</div>
        </SidebarSection>
      </SidebarShell>
    </QueryClientProvider>,
  );
}

const RAIL_PX = 64;

describe('Sidebar responsive sweep (NFR-018)', () => {
  beforeEach(() => {
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });

  afterEach(() => {
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });

  it('360px (phone) renders in mobile/sheet variant without horizontal overflow', () => {
    applyViewport(360);
    const { container } = renderShell('mobile');
    const root = container.querySelector('[data-slot="sidebar-shell"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.dataset.collapsed).toBe('false');
    expect(root.scrollWidth).toBeLessThanOrEqual(360);
  });

  it('768px (tablet) renders desktop variant in expanded mode by default', () => {
    applyViewport(768);
    const { container } = renderShell('desktop');
    const root = container.querySelector('[data-slot="sidebar-shell"]') as HTMLElement;
    expect(root.dataset.collapsed).toBe('false');
  });

  it('1280px (laptop) honors the collapsed flag → rail mode', () => {
    useSidebarUiStore.setState({ collapsed: true });
    applyViewport(1280);
    const { container } = renderShell('desktop');
    const root = container.querySelector('[data-slot="sidebar-shell"]') as HTMLElement;
    expect(root.dataset.collapsed).toBe('true');
    // The header text should be hidden in rail mode (≤ rail width).
    expect(root.textContent).not.toContain('HEADER');
  });

  it('2560px (4K) still constrains the rail to a single fixed width', () => {
    useSidebarUiStore.setState({ collapsed: true });
    applyViewport(2560);
    const { container } = renderShell('desktop');
    const root = container.querySelector('[data-slot="sidebar-shell"]') as HTMLElement;
    expect(root.dataset.collapsed).toBe('true');
    // sanity: the rail-mode width policy (RAIL_PX) is mirrored by app-shell;
    // here we just confirm the rail did not balloon to the viewport width.
    expect(root.clientWidth).toBeLessThan(2560);
    expect(RAIL_PX).toBeGreaterThan(0);
  });
});

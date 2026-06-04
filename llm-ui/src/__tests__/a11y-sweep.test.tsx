import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';

import userEvent from '@testing-library/user-event';

import { UsersTab } from '@/components/admin/org/users-tab';
import { WorkspaceSwitcher } from '@/components/sidebar/workspace-switcher';
import { SidebarAccountMenu } from '@/components/sidebar/sidebar-account-menu';
import { OrgSections } from '@/components/sidebar/org-sections';
import { ChatSection } from '@/components/sidebar/chat-section';
import { TemplatesSection } from '@/components/sidebar/templates-section';
import { WorkspaceSettingsNav } from '@/components/sidebar/workspace-settings-nav';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import { ProvidersTab } from '@/components/admin/org/providers-tab';
import { TemplatesTab } from '@/components/admin/org/templates-tab';
import { MembersTab } from '@/components/admin/workspace/members-tab';
import { RolesTab } from '@/components/admin/workspace/roles-tab';
import { WsProvidersTab } from '@/components/admin/workspace/ws-providers-tab';
import { WsTemplatesTab } from '@/components/admin/workspace/ws-templates-tab';
import { QuotasTab } from '@/components/admin/workspace/quotas-tab';

import { resetOrgUserHandlers } from '@/mocks/handlers/admin-users';
import { resetOrgProviderHandlers } from '@/mocks/handlers/admin-org-providers-handlers';
import {
  makeOrgTemplatesHandlers,
  makeOrgTemplatesStore,
} from '@/mocks/handlers/admin-org-templates-handlers';
import { resetWsMembersHandlers } from '@/mocks/handlers/admin-ws-members-handlers';
import { resetWsProvidersHandlers } from '@/mocks/handlers/admin-ws-providers-handlers';
import { resetWsTemplatesHandlers } from '@/mocks/handlers/admin-ws-templates-handlers';
import { resetWsQuotasHandlers } from '@/mocks/handlers/admin-ws-quotas-handlers';
import { server } from '@/mocks/server';

import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<
    typeof import('@tanstack/react-router')
  >('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => () => {},
    useParams: () => ({}),
    Link: ({
      children,
      to,
      ...rest
    }: {
      children: ReactNode;
      to?: string;
    } & Record<string, unknown>) => (
      <a href={typeof to === 'string' ? to : '#'} {...(rest as object)}>
        {children}
      </a>
    ),
  };
});

interface Wait {
  ready: () => Promise<void>;
}

interface TabSpec {
  name: string;
  Comp: ComponentType;
  wait: Wait;
}

const waitForTable: Wait = {
  ready: async () => {
    await waitFor(
      () => {
        expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  },
};

const waitForText = (text: RegExp | string): Wait => ({
  ready: async () => {
    await screen.findByText(text);
  },
});

const tabs: TabSpec[] = [
  { name: 'org-users', Comp: UsersTab, wait: waitForTable },
  { name: 'org-providers', Comp: ProvidersTab, wait: waitForTable },
  { name: 'org-templates', Comp: TemplatesTab, wait: waitForText(/Summarize/) },
  { name: 'ws-members', Comp: MembersTab, wait: waitForTable },
  { name: 'ws-roles', Comp: RolesTab, wait: waitForText(/Owner/) },
  {
    name: 'ws-providers',
    Comp: WsProvidersTab,
    wait: waitForText(/provider/i),
  },
  {
    name: 'ws-templates',
    Comp: WsTemplatesTab,
    wait: waitForText(/template/i),
  },
  { name: 'ws-quotas', Comp: QuotasTab, wait: waitForTable },
];

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function Wrapper({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function applyTheme(theme: 'light' | 'dark'): void {
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

async function expectNoSeriousAxe(container: HTMLElement) {
  const results = await axe(container);
  const serious = (results.violations ?? []).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

beforeEach(() => {
  resetOrgUserHandlers();
  resetOrgProviderHandlers();
  resetWsMembersHandlers();
  resetWsProvidersHandlers();
  resetWsTemplatesHandlers();
  resetWsQuotasHandlers();
  const templatesStore = makeOrgTemplatesStore([
    {
      id: 'tpl_1',
      name: 'Summarize',
      description: 'Summary template',
      body: 'You are a summarizer. {input}',
      tags: ['chat'],
      updatedAt: '2026-05-01T12:00:00.000Z',
    },
  ]);
  server.use(...makeOrgTemplatesHandlers(templatesStore));
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
});

afterEach(() => {
  applyTheme('light');
  useAuthStore.getState().clear();
  cleanup();
});

describe('Admin a11y sweep', () => {
  for (const tab of tabs) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${tab.name} / ${theme} - zero serious/critical axe violations`, async () => {
        applyTheme(theme);
        const client = makeClient();
        const { container } = render(
          <Wrapper client={client}>
            <tab.Comp />
          </Wrapper>,
        );
        await tab.wait.ready();
        await expectNoSeriousAxe(container);
      });
    }
  }
});

interface SidebarSpec {
  name: string;
  render: () => Promise<HTMLElement>;
}

function seedWorkspace(role: 'admin' | 'member' = 'admin'): void {
  useActiveWorkspaceStore
    .getState()
    .setActiveWorkspace('wsp_acme', role);
  useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
}

function seedOrg(): void {
  useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
  useSidebarUiStore.setState({ context: 'org', collapsed: false });
}

describe('Sidebar a11y sweep', () => {
  afterEach(() => {
    useActiveWorkspaceStore.getState().clear();
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });

  const sidebarSpecs: SidebarSpec[] = [
    {
      name: 'workspace-switcher-open',
      render: async () => {
        seedWorkspace();
        const client = makeClient();
        const { container } = render(
          <Wrapper client={client}>
            <WorkspaceSwitcher />
          </Wrapper>,
        );
        const user = userEvent.setup();
        await user.click(await screen.findByRole('button', { name: /switch workspace/i }));
        await screen.findByRole('menu');
        return container;
      },
    },
    {
      name: 'sidebar-account-menu-open',
      render: async () => {
        seedWorkspace();
        const client = makeClient();
        const { container } = render(
          <Wrapper client={client}>
            <SidebarAccountMenu />
          </Wrapper>,
        );
        const user = userEvent.setup();
        await user.click(
          await screen.findByRole('button', { name: /open account menu/i }),
        );
        await screen.findByRole('menu');
        return container;
      },
    },
    {
      name: 'org-sections-admin',
      render: async () => {
        seedOrg();
        const client = makeClient();
        const { container } = render(
          <Wrapper client={client}>
            <OrgSections />
          </Wrapper>,
        );
        await screen.findByText(/workspaces/i);
        return container;
      },
    },
    {
      name: 'workspace-chat-section',
      render: async () => {
        seedWorkspace();
        const client = makeClient();
        const { container } = render(
          <Wrapper client={client}>
            <ChatSection />
          </Wrapper>,
        );
        await waitFor(() =>
          expect(
            screen.queryByRole('searchbox', { name: /search conversations/i }),
          ).toBeInTheDocument(),
        );
        return container;
      },
    },
    {
      name: 'workspace-templates-section',
      render: async () => {
        seedWorkspace();
        const client = makeClient();
        const { container } = render(
          <Wrapper client={client}>
            <TemplatesSection />
          </Wrapper>,
        );
        await waitFor(
          () => {
            const heading = screen.queryByText(/suggested for you/i);
            const empty = screen.queryByText(/no templates yet/i);
            expect(heading || empty).toBeTruthy();
          },
          { timeout: 3000 },
        );
        return container;
      },
    },
    {
      name: 'workspace-settings-nav-admin',
      render: async () => {
        seedWorkspace();
        const client = makeClient();
        const { container } = render(
          <Wrapper client={client}>
            <WorkspaceSettingsNav />
          </Wrapper>,
        );
        await screen.findByRole('link', { name: 'Members' });
        return container;
      },
    },
  ];

  for (const spec of sidebarSpecs) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${spec.name} / ${theme} - zero serious/critical axe violations`, async () => {
        applyTheme(theme);
        const container = await spec.render();
        await expectNoSeriousAxe(container);
      });
    }
  }
});

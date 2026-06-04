# Admin primitives

Shared building blocks for `/admin/org` and `/admin/workspace`. All primitives are
contrast-audited under both light and dark themes and asserted axe-clean.

## Add a new tab

Tabs are passed declaratively to `AdminTabs` from the route file:

```tsx
<AdminTabs
  ariaLabel="Organization admin sections"
  defaultValue="users"
  items={[
    { value: 'users', label: 'Users', content: <UsersTab /> },
    // …
  ]}
/>
```

Wrap heavy tab bodies in `React.lazy` + `Suspense` with `<DataTableSkeleton columnCount=… />`
as the fallback so the bundle pays only for the active tab and the skeleton matches the
final table grid (no layout shift):

```tsx
const UsersTab = React.lazy(() => import('./users-tab'));

const items = [
  {
    value: 'users',
    label: 'Users',
    content: (
      <Suspense fallback={<DataTableSkeleton columnCount={4} />}>
        <UsersTab />
      </Suspense>
    ),
  },
];
```

Below 768 px the tablist is swapped for a labelled native `<select>` — keep tab
labels short enough to render cleanly in that fallback.

## StatusBadge: no opacity tints on backgrounds

`StatusBadge` maps each intent to a **full-saturation** token pair (e.g.
`bg-success text-success-foreground`). Do not introduce tinted variants like
`bg-success/15`: the tinted background almost always fails WCAG AA against the
darker foreground unless the foreground is also retuned, and silent regressions
slip past code review. The contrast audit in `llm-ui/scripts/audit-contrast.ts`
only covers the full-saturation pairs.

State must never be conveyed by color alone — every intent renders an icon
**and** a visible text label.

## FormDialog: `secret: true` for credentials

Fields marked `secret: true` in the `fields` prop are rendered as
`<input type="password" autoComplete="off" spellCheck={false}>` automatically.
Use this for API keys and tokens — never for passwords the user must confirm.

## File layout

- `admin-console-shell.tsx` — title + slot
- `admin-tabs.tsx` — desktop tablist (WAI-ARIA APG) + mobile `<select>` fallback
- `data-table.tsx` (+ `-skeleton`, `-empty`, `-error`) — state machine
- `status-badge.tsx` — intent → verified token pair + icon
- `form-dialog.tsx` — Radix Dialog + RHF + zod
- `empty-state.tsx` — icon + heading + body + CTA

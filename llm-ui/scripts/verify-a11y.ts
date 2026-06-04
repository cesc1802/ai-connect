/**
 * verify-a11y: sequentially run contrast audit, a11y-sweep, and lint.
 * Exits non-zero on first failure. Prints the manual keyboard checklist on success.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

interface Step {
  name: string;
  cmd: string;
  args: string[];
}

const steps: Step[] = [
  {
    name: 'contrast-audit',
    cmd: 'pnpm',
    args: ['exec', 'tsx', 'scripts/audit-contrast.ts'],
  },
  {
    name: 'vitest-axe-sweep',
    cmd: 'pnpm',
    args: ['exec', 'vitest', '--run', 'src/__tests__/a11y-sweep.test.tsx'],
  },
  {
    name: 'sidebar-token-lint',
    cmd: 'pnpm',
    args: ['exec', 'vitest', '--run', 'src/__tests__/sidebar-token-lint.test.ts'],
  },
  {
    name: 'sidebar-responsive',
    cmd: 'pnpm',
    args: ['exec', 'vitest', '--run', 'src/__tests__/sidebar-responsive.test.tsx'],
  },
  {
    name: 'sidebar-reduced-motion',
    cmd: 'pnpm',
    args: [
      'exec',
      'vitest',
      '--run',
      'src/__tests__/sidebar-reduced-motion.test.tsx',
    ],
  },
  {
    name: 'lint',
    cmd: 'pnpm',
    args: ['run', 'lint'],
  },
];

const keyboardChecklist = `
Manual keyboard-only verification checklist (perform once per release):
  [ ] Tab through every admin tab without using a mouse; focus ring is always visible.
  [ ] All interactive controls reachable in DOM order; no focus traps in dialogs.
  [ ] Escape closes every dialog and returns focus to the trigger.
  [ ] Enter activates primary action; Space toggles checkboxes/switches.
  [ ] Screen-reader announces row/column headers in DataTable.
  [ ] StatusBadge meaning is conveyed by icon + text, never color alone.
  [ ] Dark theme preserves >= 4.5:1 contrast on body text and >= 3:1 on large text.
`;

function run(step: Step): number {
  process.stdout.write(`\n>>> ${step.name}: ${step.cmd} ${step.args.join(' ')}\n`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    process.stderr.write(`failed to spawn ${step.cmd}: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

for (const step of steps) {
  const code = run(step);
  if (code !== 0) {
    process.stderr.write(`\n[verify-a11y] step "${step.name}" failed (exit ${code}).\n`);
    process.exit(code);
  }
}

process.stdout.write('\n[verify-a11y] all automated gates passed.\n');
process.stdout.write(keyboardChecklist);
process.exit(0);

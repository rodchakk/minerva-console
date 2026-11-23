#!/usr/bin/env node
// ENTRY Billing: read-only inventory of local Git worktrees. No database access.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const expected = [
  'supabase/migrations/20261106120000_entry_billing_005b_operations.sql',
  'supabase/tests/entry-billing-005b-operations.sql',
  'supabase/tests/entry-billing-005b-post-concurrency.sql',
  'supabase/tests/fixtures/entry-billing-005b-operations-seed.sql',
  'scripts/entry-billing-005a-local.mjs',
];

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  }).trimEnd();
}

function parseWorktrees(s) {
  return s.split(/\r?\n\r?\n/).map(block => {
    const lines = block.split(/\r?\n/);
    const worktree = lines.find(line => line.startsWith('worktree '));
    if (!worktree) return null;
    return {
      path: worktree.slice(9),
      head: (lines.find(line => line.startsWith('HEAD ')) ?? '').slice(5),
      branch: (lines.find(line => line.startsWith('branch ')) ?? '').slice(7).replace(/^refs\/heads\//, ''),
      prunable: lines.some(line => line.startsWith('prunable')),
    };
  }).filter(Boolean);
}

try {
  const repository = git(root, ['rev-parse', '--show-toplevel']);
  const worktrees = parseWorktrees(git(repository, ['worktree', 'list', '--porcelain']));
  const matches = worktrees.filter(w => /entry.billing|financial.hardening|billing.005/i.test(`${w.branch} ${w.path}`));
  const details = matches.map(w => {
    if (!existsSync(w.path) || w.prunable) {
      return { ...w, available: false };
    }
    try {
      const status = git(w.path, ['status', '--porcelain=v1', '--untracked-files=all'])
        .split(/\r?\n/).filter(Boolean);
      return {
        ...w,
        available: true,
        dirty_entries: status.length,
        staged_entries: status.filter(s => s[0] !== ' ' && s[0] !== '?').length,
        untracked_entries: status.filter(s => s.startsWith('??')).length,
        billing_entries: status.filter(s => /billing|financial/i.test(s.slice(3))).length,
        expected_files: expected.filter(file => existsSync(path.join(w.path, ...file.split('/')))),
      };
    } catch (error) {
      return { ...w, available: true, error: `Git status unavailable (${error.status ?? 'unknown'})` };
    }
  });
  console.log(JSON.stringify({
    kind: 'ENTRY_BILLING_LOCAL_WORKTREE_INVENTORY',
    readonly: true,
    repository,
    total_worktrees: worktrees.length,
    billing_worktrees: details,
    next_step: matches.length === 0
      ? 'Locate the original local checkout and run the inventory from that Git repository.'
      : 'Review uncommitted work in the original worktrees; do not reset, clean, switch branches, merge, or deploy.',
  }, null, 2));
  if (!matches.length) process.exitCode = 2;
} catch (error) {
  console.error(`Billing inventory failed: ${error.message}`);
  process.exitCode = 1;
}

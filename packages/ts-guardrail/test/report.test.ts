import Ajv2020 from 'ajv/dist/2020';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { loadDefaults } from '../src/config';
import { formatAgent, formatJson } from '../src/report';
import { createRepo, git, longFunction, runCli, SHARED, write } from './helpers';

interface Output {
  passed: boolean;
  violations: Array<{ rule: string }>;
}

const BANNED_LINE = 'Do NOT add suppression comments (' + 'NO' + 'PMD, @Suppress' + 'Warnings, eslint-' + 'disable, jscpd:' + 'ignore).';

test('agent output matches the golden text and sorts by rule and target', () => {
  const text = formatAgent(
    [
      { rule: 'NESTING_TOO_DEEP', target: 'src/b.ts :: B.run', before: 3, after: 4, limit: 3 },
      { rule: 'FILE_TOO_LONG', target: 'src/a.ts', before: null, after: 300, limit: 250 },
    ],
    'onecx-guardrail --staged',
  );
  const expected = `[ONECX-GUARDRAIL FAILED] Commit blocked by deterministic Clean Code & architecture checks.
${BANNED_LINE}
Fix the design and re-run the guardrail.

1. VIOLATION: FILE_TOO_LONG
   - Target: src/a.ts
   - Metric: new -> 300 (allowed: <= 250)
   - Clean Code Principle: Single Responsibility / High Cohesion
   - Why: Large files collect unrelated responsibilities and cause merge conflicts.
   - Fix: Split by responsibility into separate modules/classes; move helpers next to their only user.

2. VIOLATION: NESTING_TOO_DEEP
   - Target: src/b.ts :: B.run
   - Metric: 3 -> 4 (allowed: <= 3)
   - Clean Code Principle: Guard Clauses
   - Why: Deep nesting hides the happy path.
   - Fix: Invert conditions and return/continue early; extract the inner block.

Re-run: onecx-guardrail --staged
`;
  assert.equal(text, expected);
});

test('--format json validates against shared/output.schema.json and keeps stderr empty', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', longFunction('big', 30));
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged', '--format', 'json']);
  assert.equal(run.status, 1);
  assert.equal(run.stderr, '');
  const schema = JSON.parse(fs.readFileSync(path.join(SHARED, 'output.schema.json'), 'utf8'));
  const validate = new Ajv2020({ strict: false }).compile(schema);
  const result = JSON.parse(run.stdout) as Output;
  assert.ok(validate(result as unknown), JSON.stringify(validate.errors));
  assert.equal(result.passed, false);
  assert.equal(result.violations[0].rule, 'FUNCTION_TOO_LONG');
  const clean = JSON.parse(formatJson([], '1.2.3')) as Output;
  assert.ok(validate(clean as unknown));
  assert.equal(clean.passed, true);
});

test('the embedded default config equals shared/default-config.json', () => {
  const shared = JSON.parse(fs.readFileSync(path.join(SHARED, 'default-config.json'), 'utf8'));
  assert.deepEqual({ ...loadDefaults() }, shared);
});

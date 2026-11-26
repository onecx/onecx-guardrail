import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { loadDefaults, mergeConfig } from '../src/config';
import { isTestFile } from '../src/files';
import { analyze, commitAll, createRepo, git, longFunction, runCli, write } from './helpers';

test('files in test folders are test files by default, at any depth', () => {
  const config = loadDefaults();
  for (const file of [
    'e2e/support.ts',
    'apps/shell/e2e/support/commands.ts',
    'src/__tests__/fixtures.ts',
    'test/helpers.ts',
    'packages/core/test/builders.ts',
    'src/test/java/a/Helper.java',
    'module-a/src/test/java/x/Builders.java',
  ]) {
    assert.equal(isTestFile(file, config), true, file);
  }
  for (const file of [
    'src/app/page.ts',
    'src/contest/entry.ts',
    'src/e2e-config.ts',
    'src/main/java/a/A.java',
    'src/main/java/com/acme/test/Util.java',
  ]) {
    assert.equal(isTestFile(file, config), false, file);
  }
});

test('an explicit testFilePatterns replaces the default patterns', () => {
  const config = mergeConfig(loadDefaults(), { testFilePatterns: ['*.spec.ts'] });
  assert.equal(isTestFile('e2e/support.ts', config), false);
  assert.equal(isTestFile('src/a.spec.ts', config), true);
});

test('a long function in an e2e support file uses the test limit', () => {
  const text = longFunction('setUp', 40);
  const limitIn = (file: string): number | undefined =>
    analyze(text, undefined, file).find((m) => m.rule === 'FUNCTION_TOO_LONG')?.limit;
  assert.equal(limitIn('e2e/support.ts'), 50);
  assert.equal(limitIn('src/support.ts'), 25);
});

const MUTUAL = (other: string, name: string, peer: string): string =>
  `import { ${peer} } from '${other}';\nexport const ${name} = (): unknown => ${peer};\n`;

test('a cycle closed by a test file is not reported, the same cycle in production is', () => {
  const repo = createRepo();
  write(repo, 'src/page.ts', MUTUAL('../e2e/support', 'page', 'support'));
  write(repo, 'e2e/support.ts', MUTUAL('../src/page', 'support', 'page'));
  assert.equal(runCli(repo, ['--strict']).status, 0);
  fs.renameSync(path.join(repo, 'e2e'), path.join(repo, 'lib'));
  write(repo, 'src/page.ts', MUTUAL('../lib/support', 'page', 'support'));
  const run = runCli(repo, ['--strict']);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /CIRCULAR_DEPENDENCY\n {3}- Target: lib\/support\.ts -> src\/page\.ts -> lib\/support\.ts/);
});

test('a deliberate cycle fixture inside a test folder is not reported', () => {
  const repo = createRepo();
  write(repo, 'test/cyclefixture/alpha.ts', MUTUAL('./beta', 'alpha', 'beta'));
  write(repo, 'test/cyclefixture/beta.ts', MUTUAL('./alpha', 'beta', 'alpha'));
  assert.equal(runCli(repo, ['--strict']).status, 0);
});

test('--staged and the baseline classify test folders the same way', () => {
  const repo = createRepo();
  write(repo, 'e2e/support.ts', longFunction('setUp', 40));
  write(repo, 'test/cyclefixture/alpha.ts', MUTUAL('./beta', 'alpha', 'beta'));
  write(repo, 'test/cyclefixture/beta.ts', MUTUAL('./alpha', 'beta', 'alpha'));
  git(repo, 'add', '-A');
  assert.equal(runCli(repo, ['--staged']).status, 0);
  assert.equal(runCli(repo, ['--init-baseline']).status, 0);
  const baseline = JSON.parse(fs.readFileSync(path.join(repo, '.guardrail-baseline.json'), 'utf8'));
  assert.deepEqual(baseline.cycles, []);
  commitAll(repo);
  write(repo, 'e2e/support.ts', longFunction('setUp', 45));
  assert.equal(runCli(repo, []).status, 0);
});

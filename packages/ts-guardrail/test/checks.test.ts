import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BANNED, commitAll, createRepo, git, runCli, write } from './helpers';

test('suppression comments on added lines are forbidden', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', `export const a = 1;\n// ${BANNED.eslint}\nexport const b = 2;\n`);
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged']);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /VIOLATION: FORBIDDEN_SUPPRESSION\n {3}- Target: src\/a\.ts:2\n {3}- Metric: new -> 1 \(allowed: <= 0\)/);
});

test('pre-existing suppressions are not rescanned, new ones are', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', `export const a = 1; // ${BANNED.tsIgnore}\n`);
  commitAll(repo);
  write(repo, 'src/a.ts', `export const a = 1; // ${BANNED.tsIgnore}\nexport const c = 3;\n`);
  git(repo, 'add', '-A');
  assert.equal(runCli(repo, ['--staged']).status, 0);
  write(repo, 'src/a.ts', `export const a = 1; // ${BANNED.tsIgnore}\nexport const c = 3; // ${BANNED.tsIgnore}\n`);
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged']);
  assert.match(run.stderr, /Target: src\/a\.ts:2/);
  assert.doesNotMatch(run.stderr, /src\/a\.ts:1\n/);
});

test('--strict scans whole files and untracked files are scanned without --staged', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', `export const a = 1; // ${BANNED.tsIgnore}\n`);
  commitAll(repo);
  assert.equal(runCli(repo, []).status, 0);
  assert.equal(runCli(repo, ['--strict']).status, 1);
  write(repo, 'src/new.ts', `export const n = 1; // ${BANNED.tsIgnore}\n`);
  assert.match(runCli(repo, []).stderr, /Target: src\/new\.ts:1/);
});

test('suppressionPatterns can be overridden by .guardrailrc.json', () => {
  const repo = createRepo();
  write(repo, '.guardrailrc.json', JSON.stringify({ suppressionPatterns: ['HACKME'] }));
  write(repo, 'src/a.ts', `// HACKME\n// ${BANNED.tsIgnore}\nexport const a = 1;\n`);
  const run = runCli(repo, []);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /src\/a\.ts:1/);
  assert.doesNotMatch(run.stderr, /src\/a\.ts:2/);
});

test('exclude and include globs from the config select files', () => {
  const repo = createRepo();
  write(repo, 'gen/big.ts', 'export function f(a: boolean) {}\n');
  write(repo, 'src/ok.ts', 'export const a = 1;\n');
  assert.equal(runCli(repo, ['--strict']).status, 1);
  write(repo, '.guardrailrc.json', JSON.stringify({ exclude: ['gen/**'] }));
  assert.equal(runCli(repo, ['--strict']).status, 0);
  write(repo, '.guardrailrc.json', JSON.stringify({ include: ['src/**'] }));
  assert.match(runCli(repo, ['--strict']).stdout, /1 file\(s\) checked/);
});

test('a new import cycle fails, an existing cycle does not', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', "import { b } from './b';\nexport const a = () => b;\n");
  write(repo, 'src/b.ts', "import { a } from './a';\nexport const b = () => a;\n");
  commitAll(repo);
  assert.equal(runCli(repo, []).status, 0);
  write(repo, 'src/c.ts', "import { d } from './d';\nexport const c = () => d;\n");
  write(repo, 'src/d.ts', "import { c } from './c';\nexport const d = () => c;\n");
  const run = runCli(repo, []);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /VIOLATION: CIRCULAR_DEPENDENCY\n {3}- Target: src\/c\.ts -> src\/d\.ts -> src\/c\.ts/);
  assert.equal(runCli(repo, ['--strict']).stderr.match(/CIRCULAR_DEPENDENCY/g)?.length, 2);
});

test('type-only imports do not create cycles', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', "import type { B } from './b';\nexport interface A { b: B }\n");
  write(repo, 'src/b.ts', "import { A } from './a';\nexport interface B { a: A }\n");
  assert.equal(runCli(repo, ['--strict']).status, 0);
});

test('new duplicated blocks are reported once, existing ones are tolerated', () => {
  const repo = createRepo();
  const lines = Array.from({ length: 30 }, (_, i) => `  total += compute(item, ${i}) * weight(item, ${i + 1});`);
  const block = (name: string): string => `export function ${name}(item: number): number {\n  let total = 0;\n${lines.join('\n')}\n  return total;\n}\n`;
  write(repo, 'src/one.ts', block('first'));
  commitAll(repo);
  write(repo, 'src/two.ts', block('second'));
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged']);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /VIOLATION: DUPLICATE_CODE\n {3}- Target: src\/one\.ts:\d+-\d+ <-> src\/two\.ts:\d+-\d+/);
  assert.equal(run.stderr.match(/DUPLICATE_CODE/g)?.length, 1);
  commitAll(repo);
  write(repo, 'src/two.ts', `${block('second')}export const extra = 1;\n`);
  git(repo, 'add', '-A');
  assert.equal(runCli(repo, ['--staged']).status, 0);
});

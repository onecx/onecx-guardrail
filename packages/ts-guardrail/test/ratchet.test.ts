import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { branchyFunction, commitAll, createRepo, git, longFunction, runCli, write } from './helpers';

test('a new bad file fails when staged', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', longFunction('big', 30));
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged']);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /VIOLATION: FUNCTION_TOO_LONG/);
  assert.match(run.stderr, /Target: src\/a\.ts :: big/);
  assert.match(run.stderr, /Metric: new -> 32 \(allowed: <= 25\)/);
  assert.match(run.stderr, /Re-run: onecx-guardrail --staged/);
});

test('a clean staged file passes and prints the success line', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', 'export const a = 1;\n');
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged']);
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '[ONECX-GUARDRAIL PASSED] 1 file(s) checked.\n');
  assert.equal(run.stderr, '');
});

test('modified legacy file: growth fails, unchanged and shrinking pass', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', longFunction('big', 30));
  commitAll(repo);
  write(repo, 'src/a.ts', longFunction('big', 40));
  git(repo, 'add', '-A');
  const grown = runCli(repo, ['--staged']);
  assert.equal(grown.status, 1);
  assert.match(grown.stderr, /Metric: 32 -> 42 \(allowed: <= 25\)/);
  write(repo, 'src/a.ts', longFunction('big', 30));
  git(repo, 'add', '-A');
  assert.equal(runCli(repo, ['--staged']).status, 0);
  write(repo, 'src/a.ts', longFunction('big', 27));
  git(repo, 'add', '-A');
  assert.equal(runCli(repo, ['--staged']).status, 0);
});

test('modified file: growth within the limit passes, crossing the limit fails', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', branchyFunction('f', 3));
  commitAll(repo);
  write(repo, 'src/a.ts', branchyFunction('f', 8));
  git(repo, 'add', '-A');
  assert.equal(runCli(repo, ['--staged']).status, 0);
  write(repo, 'src/a.ts', branchyFunction('f', 12));
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged']);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /CYCLOMATIC_COMPLEXITY[\s\S]*Metric: 4 -> 13 \(allowed: <= 10\)/);
});

test('a new function in a modified file is held to the hard limit', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', longFunction('old', 30));
  commitAll(repo);
  write(repo, 'src/a.ts', longFunction('old', 30) + longFunction('fresh', 30));
  git(repo, 'add', '-A');
  const run = runCli(repo, ['--staged']);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Target: src\/a\.ts :: fresh/);
  assert.doesNotMatch(run.stderr, /:: old/);
});

test('--strict ignores HEAD and fails on legacy debt', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', longFunction('big', 30));
  commitAll(repo);
  assert.equal(runCli(repo, []).status, 0);
  const strict = runCli(repo, ['--strict']);
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /Metric: new -> 32/);
});

test('baseline round trip: init writes a sorted file, then legacy debt passes and growth fails', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', longFunction('big', 30));
  const init = runCli(repo, ['--init-baseline']);
  assert.equal(init.status, 0);
  const text = fs.readFileSync(path.join(repo, '.guardrail-baseline.json'), 'utf8');
  const parsed = JSON.parse(text);
  assert.equal(parsed.runtime, 'ts');
  assert.equal(parsed.metrics['FUNCTION_TOO_LONG|src/a.ts|big'], 32);
  assert.equal(parsed.files['src/a.ts'], 32);
  assert.deepEqual(Object.keys(parsed.metrics), Object.keys(parsed.metrics).sort());
  assert.equal(text, `${JSON.stringify(parsed, null, 2)}\n`);
  assert.equal(runCli(repo, []).status, 0);
  write(repo, 'src/a.ts', longFunction('big', 31));
  assert.equal(runCli(repo, []).status, 1);
  write(repo, 'src/b.ts', longFunction('other', 30));
  write(repo, 'src/a.ts', longFunction('big', 30));
  const fresh = runCli(repo, []);
  assert.match(fresh.stderr, /Target: src\/b\.ts :: other/);
});

test('HEAD is extracted into a private temp directory that is removed afterwards', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', 'export const a = 1;\n');
  commitAll(repo);
  write(repo, 'src/a.ts', 'export const a = 2;\n');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrail-tmp-'));
  const run = runCli(repo, [], { ...process.env, TMPDIR: tmp });
  assert.equal(run.status, 0);
  assert.deepEqual(fs.readdirSync(tmp), []);
});

test('usage errors exit with 2', () => {
  const repo = createRepo();
  assert.equal(runCli(repo, ['--bogus']).status, 2);
  assert.equal(runCli(repo, ['--format', 'xml']).status, 2);
  assert.equal(runCli(repo, ['--baseline', 'missing.json']).status, 2);
});

test('a renamed legacy file (also with spaces) keeps its history; deleted files are ignored', () => {
  const repo = createRepo();
  write(repo, 'src/a.ts', longFunction('big', 30));
  write(repo, 'src/gone.ts', longFunction('old', 30));
  commitAll(repo);
  git(repo, 'mv', 'src/a.ts', 'src/my a.ts');
  git(repo, 'rm', '-q', 'src/gone.ts');
  const moved = runCli(repo, ['--staged']);
  assert.equal(moved.status, 0, moved.stderr);
  assert.equal(moved.stdout, '[ONECX-GUARDRAIL PASSED] 1 file(s) checked.\n');
  write(repo, 'src/my a.ts', longFunction('big', 40));
  git(repo, 'add', '-A');
  const grown = runCli(repo, ['--staged']);
  assert.equal(grown.status, 1);
  assert.match(grown.stderr, /Target: src\/my a\.ts :: big\n.*Metric: 32 -> 42/);
});

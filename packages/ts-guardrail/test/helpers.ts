import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeSource } from '../src/analyze';
import { loadDefaults, mergeConfig } from '../src/config';
import { Metric, GuardrailConfig } from '../src/types';

export const CLI = path.join(__dirname, '..', 'src', 'cli.js');
export const SHARED = path.join(__dirname, '..', '..', '..', '..', 'shared');

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/** Fresh git repository with one commit (an empty README is not a language file). */
export function createRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrail-test-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  return dir;
}

export function write(repo: string, file: string, content: string): void {
  const full = path.join(repo, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

export function commitAll(repo: string): void {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'commit');
}

export interface CliRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runCli(repo: string, args: string[], env: NodeJS.ProcessEnv = process.env): CliRun {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: repo, encoding: 'utf8', env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function configWith(thresholds: Record<string, number>): GuardrailConfig {
  return mergeConfig(loadDefaults(), { thresholds });
}

export function analyze(text: string, config: GuardrailConfig = loadDefaults(), file = 'src/a.ts'): Metric[] {
  return analyzeSource({ file, text, config });
}

export function valueOf(metrics: Metric[], rule: string, symbol: string): number | undefined {
  return metrics.find((m) => m.rule === rule && m.symbol === symbol)?.value;
}

/** A function whose body has `count` statement lines. */
export function longFunction(name: string, count: number): string {
  const body = Array.from({ length: count }, (_, i) => `  const v${i} = ${i};`).join('\n');
  return `export function ${name}(): void {\n${body}\n}\n`;
}

/** A function with `count` sequential if statements (cyclomatic = count + 1). */
export function branchyFunction(name: string, count: number): string {
  const body = Array.from({ length: count }, (_, i) => `  if (x === ${i}) { y += ${i}; }`).join('\n');
  return `export function ${name}(x: number): number {\n  let y = 0;\n${body}\n  return y;\n}\n`;
}

/** Words that the suppression scan forbids, assembled so this file stays clean. */
export const BANNED = {
  eslint: 'eslint-' + 'disable-next-line',
  tsIgnore: '@ts-' + 'ignore',
};

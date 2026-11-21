#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { formatAgent, formatJson, formatPassed } from './report';
import { runGuardrail } from './run';
import { RunOptions, UsageError } from './types';

const USAGE = `Usage: onecx-guardrail [--staged] [--baseline <path>] [--init-baseline] [--strict]
                       [--config <path>] [--format agent|json] [--root <dir>]
Exit codes: 0 pass, 1 violations, 2 usage/internal error.
`;

const FLAGS = {
  staged: { type: 'boolean' },
  baseline: { type: 'string' },
  'init-baseline': { type: 'boolean' },
  strict: { type: 'boolean' },
  config: { type: 'string' },
  format: { type: 'string' },
  root: { type: 'string' },
  help: { type: 'boolean' },
  version: { type: 'boolean' },
} as const;

export interface Parsed {
  run: RunOptions;
  format: 'agent' | 'json';
  help: boolean;
  version: boolean;
}

export function parseCli(argv: string[]): Parsed {
  let values: ReturnType<typeof parseArgs<{ options: typeof FLAGS }>>['values'];
  try {
    values = parseArgs({ args: argv, options: FLAGS, allowPositionals: false }).values;
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const format = values.format ?? 'agent';
  if (format !== 'agent' && format !== 'json') throw new UsageError(`unknown --format "${format}" (agent|json)`);
  const run: RunOptions = {
    staged: values.staged === true,
    baseline: values.baseline,
    initBaseline: values['init-baseline'] === true,
    strict: values.strict === true,
    config: values.config,
    root: values.root,
  };
  return { run, format, help: values.help === true, version: values.version === true };
}

export function packageVersion(): string {
  const file = path.join(__dirname, '..', '..', 'package.json');
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { version: string }).version;
}

function emit(parsed: Parsed, result: Awaited<ReturnType<typeof runGuardrail>>, argv: string[]): number {
  const passed = result.violations.length === 0;
  if (parsed.format === 'json') {
    process.stdout.write(formatJson(result.violations, packageVersion()));
  } else if (passed) {
    process.stdout.write(result.message ? `${result.message}\n` : formatPassed(result.filesChecked));
  } else {
    process.stderr.write(formatAgent(result.violations, `onecx-guardrail ${argv.join(' ')}`.trim()));
  }
  return passed ? 0 : 1;
}

export async function main(argv: string[]): Promise<number> {
  try {
    const parsed = parseCli(argv);
    if (parsed.help) return writeAndReturn(USAGE);
    if (parsed.version) return writeAndReturn(`${packageVersion()}\n`);
    return emit(parsed, await runGuardrail(parsed.run), argv);
  } catch (error) {
    process.stderr.write(`onecx-guardrail: error: ${(error as Error).message}\n`);
    return 2;
  }
}

function writeAndReturn(text: string): number {
  process.stdout.write(text);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

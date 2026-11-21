import { RULES } from './rules';
import { Violation } from './types';

/** Built from parts so that this file does not trip its own suppression scan. */
const BANNED = ['NO' + 'PMD', '@Suppress' + 'Warnings', 'eslint-' + 'disable', 'jscpd:' + 'ignore'];

const HEADER = [
  '[ONECX-GUARDRAIL FAILED] Commit blocked by deterministic Clean Code & architecture checks.',
  `Do NOT add suppression comments (${BANNED.join(', ')}).`,
  'Fix the design and re-run the guardrail.',
];

export function sortViolations(violations: Violation[]): Violation[] {
  const compare = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
  return [...violations].sort((x, y) => compare(x.rule, y.rule) || compare(x.target, y.target));
}

function formatOne(violation: Violation, number: number): string {
  const info = RULES[violation.rule];
  const before = violation.before === null ? 'new' : String(violation.before);
  return [
    `${number}. VIOLATION: ${violation.rule}`,
    `   - Target: ${violation.target}`,
    `   - Metric: ${before} -> ${violation.after} (allowed: <= ${violation.limit})`,
    `   - Clean Code Principle: ${info.principle}`,
    `   - Why: ${info.why}`,
    `   - Fix: ${info.fix}`,
  ].join('\n');
}

export function formatAgent(violations: Violation[], command: string): string {
  const body = sortViolations(violations).map((violation, index) => formatOne(violation, index + 1));
  return [...HEADER, '', ...body.flatMap((block) => [block, '']), `Re-run: ${command}`, ''].join('\n');
}

export function formatPassed(filesChecked: number): string {
  return `[ONECX-GUARDRAIL PASSED] ${filesChecked} file(s) checked.\n`;
}

export function formatJson(violations: Violation[], version: string): string {
  const entries = sortViolations(violations).map((violation) => ({ ...violation, ...RULES[violation.rule] }));
  const result = { tool: 'onecx-guardrail', version, runtime: 'ts', passed: entries.length === 0, violations: entries };
  return `${JSON.stringify(result, null, 2)}\n`;
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSource } from './analyze';
import { BeforeSource } from './before';
import { cloneTarget, findClones } from './clones';
import { cycleKey, cycleTarget, findCycles } from './cycles';
import { ratchetMetrics } from './ratchet';
import { collectAddedLines, scanLines, wholeFileLines } from './suppressions';
import { GuardrailConfig, Metric, Violation } from './types';

export interface CheckContext {
  root: string;
  config: GuardrailConfig;
  strict: boolean;
  staged: boolean;
  inspected: string[];
  all: string[];
  before: BeforeSource;
}

export function analyzeFile(ctx: Pick<CheckContext, 'root' | 'config'>, file: string): Metric[] {
  const text = fs.readFileSync(path.join(ctx.root, file), 'utf8');
  return analyzeSource({ file, text, config: ctx.config });
}

export function metricViolations(ctx: CheckContext): Violation[] {
  return ctx.inspected.flatMap((file) => ratchetMetrics(analyzeFile(ctx, file), ctx.before.metricsFor(file)));
}

export async function cycleViolations(ctx: CheckContext): Promise<Violation[]> {
  const inspected = new Set(ctx.inspected);
  const cycles = (await findCycles({ root: ctx.root, files: ctx.all })).filter((members) =>
    members.some((file) => inspected.has(file)),
  );
  if (cycles.length === 0) return [];
  const known = await ctx.before.cycleKeys();
  return cycles
    .filter((members) => !known.has(cycleKey(members)))
    .map((members) => ({ rule: 'CIRCULAR_DEPENDENCY', target: cycleTarget(members), before: null, after: 1, limit: 0 }));
}

export async function cloneViolations(ctx: CheckContext): Promise<Violation[]> {
  const inspected = new Set(ctx.inspected);
  const clones = (await findClones({ root: ctx.root, files: ctx.all, config: ctx.config })).filter(
    (clone) => inspected.has(clone.a.file) || inspected.has(clone.b.file),
  );
  if (clones.length === 0) return [];
  const known = await ctx.before.cloneKeys();
  return clones
    .filter((clone) => !known.has(clone.key))
    .map((clone) => ({ rule: 'DUPLICATE_CODE', target: cloneTarget(clone), before: null, after: 1, limit: 0 }));
}

export function suppressionViolations(ctx: CheckContext): Violation[] {
  const patterns = ctx.config.suppressionPatterns;
  if (ctx.strict) return scanLines(ctx.inspected.flatMap((file) => wholeFileLines(ctx.root, file)), patterns);
  return scanLines(collectAddedLines({ root: ctx.root, staged: ctx.staged, config: ctx.config }), patterns);
}

import * as fs from 'node:fs';
import { metricKey } from './ratchet';
import { Metric, UsageError } from './types';

export const DEFAULT_BASELINE = '.guardrail-baseline.json';

export interface Baseline {
  version: 1;
  runtime: 'ts';
  metrics: Record<string, number>;
  files: Record<string, number>;
  cycles: string[];
  clones: string[];
}

export interface BaselineInput {
  metrics: Metric[];
  cycles: string[];
  clones: string[];
}

function sortedRecord(source: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of Object.keys(source).sort()) result[key] = source[key];
  return result;
}

export function buildBaseline(input: BaselineInput): Baseline {
  const metrics: Record<string, number> = {};
  const files: Record<string, number> = {};
  for (const metric of input.metrics) {
    metrics[metricKey(metric)] = metric.value;
    if (metric.rule === 'FILE_TOO_LONG') files[metric.file] = metric.value;
  }
  return {
    version: 1,
    runtime: 'ts',
    metrics: sortedRecord(metrics),
    files: sortedRecord(files),
    cycles: [...new Set(input.cycles)].sort(),
    clones: [...new Set(input.clones)].sort(),
  };
}

export function serializeBaseline(baseline: Baseline): string {
  const ordered = {
    version: baseline.version,
    runtime: baseline.runtime,
    metrics: sortedRecord(baseline.metrics),
    files: sortedRecord(baseline.files),
    cycles: [...baseline.cycles].sort(),
    clones: [...baseline.clones].sort(),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function writeBaseline(file: string, baseline: Baseline): void {
  fs.writeFileSync(file, serializeBaseline(baseline));
}

export function parseBaseline(text: string, source: string): Baseline {
  let raw: Partial<Baseline>;
  try {
    raw = JSON.parse(text) as Partial<Baseline>;
  } catch {
    throw new UsageError(`baseline ${source} is not valid JSON`);
  }
  if (raw.version !== 1 || raw.runtime !== 'ts') {
    throw new UsageError(`baseline ${source} is not a version 1 "ts" baseline`);
  }
  return {
    version: 1,
    runtime: 'ts',
    metrics: raw.metrics ?? {},
    files: raw.files ?? {},
    cycles: raw.cycles ?? [],
    clones: raw.clones ?? [],
  };
}

export function readBaseline(file: string): Baseline {
  return parseBaseline(fs.readFileSync(file, 'utf8'), file);
}

/** Metric map of one file, or null when the file is not part of the baseline (new file). */
export function baselineMetricsFor(baseline: Baseline, file: string): Map<string, number> | null {
  if (!(file in baseline.files)) return null;
  const marker = `|${file}|`;
  const result = new Map<string, number>();
  for (const [key, value] of Object.entries(baseline.metrics)) {
    if (key.indexOf(marker) > 0 && keyFile(key) === file) result.set(key, value);
  }
  return result;
}

function keyFile(key: string): string {
  const first = key.indexOf('|');
  const second = key.indexOf('|', first + 1);
  return key.slice(first + 1, second);
}

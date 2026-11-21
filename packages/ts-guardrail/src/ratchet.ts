import { Metric, Violation } from './types';

export function metricKey(metric: Pick<Metric, 'rule' | 'file' | 'symbol'>): string {
  return `${metric.rule}|${metric.file}|${metric.symbol}`;
}

export function metricMap(metrics: Metric[]): Map<string, number> {
  return new Map(metrics.map((metric) => [metricKey(metric), metric.value]));
}

export function targetOf(metric: Pick<Metric, 'file' | 'symbol'>): string {
  return metric.symbol === '-' ? metric.file : `${metric.file} :: ${metric.symbol}`;
}

/**
 * before === null means "new file": every limit is hard.
 * Otherwise a violation needs after > limit and after > before (absent key = new).
 */
export function ratchetMetrics(after: Metric[], before: Map<string, number> | null): Violation[] {
  const violations: Violation[] = [];
  for (const metric of after) {
    if (metric.value <= metric.limit) continue;
    const previous = before?.get(metricKey(metric)) ?? null;
    if (previous !== null && metric.value <= previous) continue;
    violations.push({
      rule: metric.rule,
      target: targetOf(metric),
      before: previous,
      after: metric.value,
      limit: metric.limit,
    });
  }
  return violations;
}

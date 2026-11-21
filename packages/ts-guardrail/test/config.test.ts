import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadDefaults, mergeConfig } from '../src/config';
import { UsageError } from '../src/types';

test('thresholds merge key-wise and list options replace the defaults', () => {
  const merged = mergeConfig(loadDefaults(), { thresholds: { maxNesting: 2 }, exclude: ['x/**'] });
  assert.equal(merged.thresholds.maxNesting, 2);
  assert.equal(merged.thresholds.maxCognitive, 15);
  assert.deepEqual(merged.exclude, ['x/**']);
  assert.equal(merged.suppressionPatterns.length, 6);
});

test('invalid config is rejected', () => {
  assert.throws(() => mergeConfig(loadDefaults(), { nope: 1 }), UsageError);
  assert.throws(() => mergeConfig(loadDefaults(), { thresholds: { maxNesting: 0 } }), UsageError);
  assert.throws(() => mergeConfig(loadDefaults(), { thresholds: { unknown: 3 } }), UsageError);
  assert.throws(() => mergeConfig(loadDefaults(), { include: 'src' }), UsageError);
});

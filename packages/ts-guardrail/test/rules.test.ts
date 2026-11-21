import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, branchyFunction, configWith, longFunction, valueOf } from './helpers';

test('function length counts code lines only and uses the test limit in spec files', () => {
  const text = `// header\n${longFunction('big', 30)}\n\n/* block */\nexport function small(): void {\n  // note\n  const a = 1;\n}\n`;
  const metrics = analyze(text);
  assert.equal(valueOf(metrics, 'FUNCTION_TOO_LONG', 'big'), 32);
  assert.equal(valueOf(metrics, 'FUNCTION_TOO_LONG', 'small'), 3);
  const prod = metrics.find((m) => m.symbol === 'big' && m.rule === 'FUNCTION_TOO_LONG');
  assert.equal(prod?.limit, 25);
  const spec = analyze(text, undefined, 'src/a.spec.ts').find((m) => m.symbol === 'big' && m.rule === 'FUNCTION_TOO_LONG');
  assert.equal(spec?.limit, 50);
});

test('file length skips blank and comment lines', () => {
  const metrics = analyze('// c\n\nexport const a = 1;\n/* x\n y */\nexport const b = 2;\n');
  assert.equal(valueOf(metrics, 'FILE_TOO_LONG', '-'), 2);
  assert.equal(metrics.find((m) => m.rule === 'FILE_TOO_LONG')?.limit, 250);
});

test('cyclomatic complexity follows the spec counting', () => {
  const text = `export function f(a: number, b?: { c: number }, d = 5): number {
  const x = b?.c ?? a;
  const y = a > 1 ? 1 : 2;
  for (const i of [1]) { if (i && x || y) { continue; } }
  switch (a) { case 1: return 1; case 2: return 2; default: return d; }
}`;
  // 1 + ?? + ternary + for + if + && + || + 2 cases (optional chaining and defaults are not counted)
  assert.equal(valueOf(analyze(text), 'CYCLOMATIC_COMPLEXITY', 'f'), 9);
  assert.equal(valueOf(analyze(branchyFunction('g', 11)), 'CYCLOMATIC_COMPLEXITY', 'g'), 12);
});

test('cognitive complexity applies nesting increments', () => {
  const text = `export function f(a: number): number {
  if (a) {
    for (const i of [a]) {
      if (i) { return 1; }
    }
  }
  return 0;
}`;
  assert.equal(valueOf(analyze(text), 'COGNITIVE_COMPLEXITY', 'f'), 6);
});

test('nesting depth counts control structures, not else-if chains', () => {
  const chain = 'export function c(a: number) { if (a) { return 1; } else if (a > 1) { return 2; } else { return 3; } }';
  assert.equal(valueOf(analyze(chain), 'NESTING_TOO_DEEP', 'c') ?? 0, 1);
  const deep = 'export function d(a: number) { if (a) { while (a) { try { if (a) { a--; } } catch { a = 0; } } } }';
  assert.equal(valueOf(analyze(deep), 'NESTING_TOO_DEEP', 'd'), 4);
});

test('switch cases exclude default', () => {
  const text = 'export function s(a: number) { switch (a) { case 1: case 2: case 3: break; default: break; } }';
  assert.equal(valueOf(analyze(text), 'SWITCH_TOO_MANY_CASES', 's'), 3);
});

test('parameters exclude this and are measured on constructors too', () => {
  const text = `export class K {
  constructor(a: number, b: number, c: number, d: number) {}
  m(this: K, a: number, b: number) {}
}`;
  const metrics = analyze(text);
  assert.equal(valueOf(metrics, 'TOO_MANY_PARAMETERS', 'K.constructor'), 4);
  assert.equal(valueOf(metrics, 'TOO_MANY_PARAMETERS', 'K.m'), 2);
  assert.equal(metrics.find((m) => m.rule === 'TOO_MANY_PARAMETERS')?.limit, 3);
});

test('boolean flag parameters are found by type, literal type and default, setters are exempt', () => {
  const text = `export function a(x: boolean, y: true, z = false, w: number) {}
export class P {
  setValue(flag: boolean) {}
  set other(flag: boolean) {}
  run(options: { flag: boolean }) {}
}
export const setAll = (flag: boolean) => flag;`;
  const metrics = analyze(text);
  assert.equal(valueOf(metrics, 'BOOLEAN_FLAG_PARAMETER', 'a'), 3);
  assert.equal(valueOf(metrics, 'BOOLEAN_FLAG_PARAMETER', 'P.setValue'), 0);
  assert.equal(valueOf(metrics, 'BOOLEAN_FLAG_PARAMETER', 'P.set other'), 0);
  assert.equal(valueOf(metrics, 'BOOLEAN_FLAG_PARAMETER', 'P.run'), 0);
  assert.equal(valueOf(metrics, 'BOOLEAN_FLAG_PARAMETER', 'setAll'), 0);
});

test('fan-out counts non-type imports only', () => {
  const text = `import type { A } from './a';
import { type B, type C } from './b';
import { d } from './d';
import { type E, f } from './e';
import g from './g';
import './side-effect';
import { h2 } from './d';`;
  assert.equal(valueOf(analyze(text), 'FAN_OUT_TOO_HIGH', '-'), 4);
});

test('thresholds can be overridden by config', () => {
  const metrics = analyze(longFunction('f', 5), configWith({ maxFunctionLines: 3, maxFileLines: 4 }));
  assert.equal(metrics.find((m) => m.rule === 'FUNCTION_TOO_LONG')?.limit, 3);
  assert.equal(metrics.find((m) => m.rule === 'FILE_TOO_LONG')?.limit, 4);
});

test('anonymous callbacks get stable symbols and duplicates are numbered', () => {
  const text = `describe('suite', () => { it('works', () => { const a = 1; }); });
function twin() {}
function twin() {}`;
  const symbols = analyze(text).map((m) => m.symbol);
  assert.ok(symbols.includes('describe("suite")'));
  assert.ok(symbols.includes('describe("suite").it("works")'));
  assert.ok(symbols.includes('twin#2'));
});

test('functions assigned to properties are measured (object literal and class property arrows)', () => {
  const body = Array.from({ length: 30 }, (_, i) => `    const v${i} = ${i};`).join('\n');
  const text = `export const obj = {\n  fn: (a: number, b: number, c: number, d: number) => a,\n};\nexport class K {\n  run = (): void => {\n${body}\n  };\n}\n`;
  const metrics = analyze(text);
  assert.equal(valueOf(metrics, 'TOO_MANY_PARAMETERS', 'obj.fn'), 4);
  assert.equal(valueOf(metrics, 'FUNCTION_TOO_LONG', 'K.run'), 32);
});

import { Linter } from 'eslint';
import * as ts from 'typescript';
import * as parser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';
import { FoundFunction } from './functions';

/** Library-measured values of one function (absent rule message = 0). */
export interface LintedFunction {
  lines: number;
  cognitive: number;
  depth: number;
  params: number;
}

export interface LintResult {
  fileLines: number;
  byFunction: Map<FoundFunction, LintedFunction>;
}

export interface LintInput {
  file: string;
  text: string;
  sf: ts.SourceFile;
  functions: FoundFunction[];
}

const COUNT = /\((\d+)\)/;
const COGNITIVE = /from (\d+) to/;
const COUNTED = { skipBlankLines: true, skipComments: true };

/** Every rule runs with limit 0 so that each non-zero value is reported; limits are applied later. */
const CONFIG: Linter.Config[] = [
  {
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' },
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    languageOptions: { parser: parser as Linter.Parser, sourceType: 'module' },
    plugins: { sonarjs: sonarjs as unknown as Record<string, unknown> },
    rules: {
      'max-lines': ['warn', { max: 0, ...COUNTED }],
      'max-lines-per-function': ['warn', { max: 0, IIFEs: true, ...COUNTED }],
      'max-params': ['warn', 0],
      'max-depth': ['warn', 0],
      'sonarjs/cognitive-complexity': ['warn', 0],
    },
  },
];

const linter = new Linter();

function numberOf(message: Linter.LintMessage): number {
  const match = (message.ruleId === 'sonarjs/cognitive-complexity' ? COGNITIVE : COUNT).exec(message.message);
  return match ? Number(match[1]) : 0;
}

/** ESLint reports a function assigned to a property at the property start (`fn: () => 1`, `x = () => 1`). */
function headStart(node: FoundFunction['node'], sf: ts.SourceFile): number {
  const parent = node.parent;
  const assigned = ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent);
  return assigned && parent.initializer === node ? parent.getStart(sf) : node.getStart(sf);
}

function innermost(functions: FoundFunction[], sf: ts.SourceFile, position: number): FoundFunction | undefined {
  let best: FoundFunction | undefined;
  let bestStart = -1;
  for (const found of functions) {
    const start = headStart(found.node, sf);
    if (position >= start && position < found.node.getEnd() && start >= bestStart) {
      best = found;
      bestStart = start;
    }
  }
  return best;
}

function apply(target: LintedFunction, message: Linter.LintMessage): void {
  const value = numberOf(message);
  if (message.ruleId === 'max-depth') target.depth = Math.max(target.depth, value);
  else if (message.ruleId === 'max-params') target.params = value;
  else if (message.ruleId === 'max-lines-per-function') target.lines = value;
  else if (message.ruleId === 'sonarjs/cognitive-complexity') target.cognitive = value;
}

export function lintSource(input: LintInput): LintResult {
  const messages = linter.verify(input.text, CONFIG, { filename: input.file });
  const byFunction = new Map<FoundFunction, LintedFunction>();
  for (const found of input.functions) byFunction.set(found, { lines: 0, cognitive: 0, depth: 0, params: 0 });
  let fileLines = 0;
  for (const message of messages) {
    if (message.fatal) throw new Error(`cannot parse ${input.file}: ${message.message}`);
    if (message.ruleId === 'max-lines') {
      fileLines = numberOf(message);
      continue;
    }
    const position = input.sf.getPositionOfLineAndCharacter(message.line - 1, message.column - 1);
    const owner = innermost(input.functions, input.sf, position);
    if (owner) apply(byFunction.get(owner) as LintedFunction, message);
  }
  return { fileLines, byFunction };
}

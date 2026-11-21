import * as ts from 'typescript';
import { collectFunctions, FoundFunction, functionName } from './functions';
import { isTestFile } from './files';
import { LintedFunction, LintResult, lintSource } from './lint';
import { FunctionMetrics, measureFunction } from './metrics';
import { GuardrailConfig, Metric, RuleCode } from './types';

export interface AnalyzeInput {
  file: string;
  text: string;
  config: GuardrailConfig;
}

interface FunctionContext {
  file: string;
  linted: LintResult;
  config: GuardrailConfig;
  isTest: boolean;
}

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  const named = clause.namedBindings;
  if (clause.name || !named || !ts.isNamedImports(named)) return false;
  return named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly);
}

function importSpecifier(statement: ts.Statement): string | undefined {
  if (ts.isImportDeclaration(statement) && !isTypeOnlyImport(statement)) {
    return ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined;
  }
  if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) {
    const ref = statement.moduleReference;
    return ts.isExternalModuleReference(ref) && ts.isStringLiteral(ref.expression) ? ref.expression.text : undefined;
  }
  return undefined;
}

export function fanOut(sf: ts.SourceFile): number {
  const specifiers = new Set<string>();
  for (const statement of sf.statements) {
    const specifier = importSpecifier(statement);
    if (specifier !== undefined) specifiers.add(specifier);
  }
  return specifiers.size;
}

function metric(rule: RuleCode, target: { file: string; symbol: string }, measure: { value: number; limit: number }): Metric {
  return { rule, file: target.file, symbol: target.symbol, value: measure.value, limit: measure.limit };
}

function valuesOf(found: FoundFunction, ctx: FunctionContext): Array<[RuleCode, number, number]> {
  const t = ctx.config.thresholds;
  const m: FunctionMetrics = measureFunction(found.node, functionName(found.node));
  const linted = ctx.linted.byFunction.get(found) as LintedFunction;
  return [
    ['FUNCTION_TOO_LONG', linted.lines, ctx.isTest ? t.maxTestFunctionLines : t.maxFunctionLines],
    ['CYCLOMATIC_COMPLEXITY', m.cyclomatic, t.maxCyclomatic],
    ['COGNITIVE_COMPLEXITY', linted.cognitive, t.maxCognitive],
    ['NESTING_TOO_DEEP', linted.depth, t.maxNesting],
    ['SWITCH_TOO_MANY_CASES', m.switchCases, t.maxSwitchCases],
    ['TOO_MANY_PARAMETERS', Math.max(0, linted.params - m.thisParameters), t.maxParameters],
    ['BOOLEAN_FLAG_PARAMETER', m.booleanFlags, 0],
  ];
}

function functionMetrics(found: FoundFunction, ctx: FunctionContext): Metric[] {
  const target = { file: ctx.file, symbol: found.symbol };
  return valuesOf(found, ctx).map(([rule, value, limit]) => metric(rule, target, { value, limit }));
}

export function analyzeSource(input: AnalyzeInput): Metric[] {
  const sf = ts.createSourceFile(input.file, input.text, ts.ScriptTarget.Latest, true);
  const functions = collectFunctions(sf);
  const linted = lintSource({ file: input.file, text: input.text, sf, functions });
  const t = input.config.thresholds;
  const target = { file: input.file, symbol: '-' };
  const result = [
    metric('FILE_TOO_LONG', target, { value: linted.fileLines, limit: t.maxFileLines }),
    metric('FAN_OUT_TOO_HIGH', target, { value: fanOut(sf), limit: t.maxFanOut }),
  ];
  const isTest = isTestFile(input.file, input.config);
  const ctx: FunctionContext = { file: input.file, linted, config: input.config, isTest };
  for (const found of functions) result.push(...functionMetrics(found, ctx));
  return result;
}

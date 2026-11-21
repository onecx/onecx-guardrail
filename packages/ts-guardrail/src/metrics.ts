import * as ts from 'typescript';
import { FunctionNode, isFunctionNode } from './functions';

const { SyntaxKind } = ts;
const BRANCHES = new Set<ts.SyntaxKind>([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CatchClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.CaseClause,
]);
const LOGICAL = new Set<ts.SyntaxKind>([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken,
]);
/** Values that no lint rule delivers in the exact SPEC counting. */
export interface FunctionMetrics {
  cyclomatic: number;
  switchCases: number;
  thisParameters: number;
  booleanFlags: number;
}

/** Visits all descendants that belong to the function itself, not to nested functions. */
function walkOwn(root: ts.Node, visit: (node: ts.Node) => void): void {
  ts.forEachChild(root, (child) => {
    if (isFunctionNode(child)) return;
    visit(child);
    walkOwn(child, visit);
  });
}

function branchWeight(node: ts.Node): number {
  if (BRANCHES.has(node.kind)) return 1;
  return ts.isBinaryExpression(node) && LOGICAL.has(node.operatorToken.kind) ? 1 : 0;
}

function cyclomatic(fn: FunctionNode): number {
  let total = 1;
  walkOwn(fn, (node) => {
    total += branchWeight(node);
  });
  return total;
}

function switchCases(fn: FunctionNode): number {
  let total = 0;
  walkOwn(fn, (node) => {
    if (ts.isCaseClause(node)) total += 1;
  });
  return total;
}

function thisParameters(fn: FunctionNode): number {
  return fn.parameters.filter((p) => ts.isIdentifier(p.name) && p.name.text === 'this').length;
}

function isBooleanLiteralType(type: ts.TypeNode): boolean {
  if (!ts.isLiteralTypeNode(type)) return false;
  return type.literal.kind === SyntaxKind.TrueKeyword || type.literal.kind === SyntaxKind.FalseKeyword;
}

function isBooleanParameter(param: ts.ParameterDeclaration): boolean {
  const type = param.type;
  if (type && (type.kind === SyntaxKind.BooleanKeyword || isBooleanLiteralType(type))) return true;
  const init = param.initializer;
  return init !== undefined && (init.kind === SyntaxKind.TrueKeyword || init.kind === SyntaxKind.FalseKeyword);
}

export function isSetter(fn: FunctionNode, name: string): boolean {
  if (ts.isSetAccessorDeclaration(fn)) return true;
  return /^set[A-Z]/.test(name) && fn.parameters.length === 1;
}

export function measureFunction(fn: FunctionNode, name: string): FunctionMetrics {
  const flags = isSetter(fn, name) ? 0 : fn.parameters.filter(isBooleanParameter).length;
  return {
    cyclomatic: cyclomatic(fn),
    switchCases: switchCases(fn),
    thisParameters: thisParameters(fn),
    booleanFlags: flags,
  };
}

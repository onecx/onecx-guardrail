import * as ts from 'typescript';

export type FunctionNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

export interface FoundFunction {
  node: FunctionNode;
  symbol: string;
}

const ANONYMOUS = '<anonymous>';

export function isFunctionNode(node: ts.Node): node is FunctionNode {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function shorten(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 60);
}

function propertyName(name: ts.Node | undefined): string {
  if (!name) return ANONYMOUS;
  if (ts.isComputedPropertyName(name)) return `[${shorten(name.expression.getText())}]`;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)) {
    return name.text;
  }
  return ANONYMOUS;
}

function callbackName(call: ts.CallExpression): string {
  const callee = shorten(call.expression.getText());
  const first = call.arguments[0];
  return first && ts.isStringLiteralLike(first) ? `${callee}("${shorten(first.text)}")` : callee;
}

function nameFromParent(node: ts.Node): string {
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) {
    return propertyName(parent.name);
  }
  if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return shorten(parent.left.getText());
  }
  return ts.isCallExpression(parent) ? callbackName(parent) : ANONYMOUS;
}

export function functionName(node: FunctionNode): string {
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isGetAccessorDeclaration(node)) return `get ${propertyName(node.name)}`;
  if (ts.isSetAccessorDeclaration(node)) return `set ${propertyName(node.name)}`;
  return node.name ? propertyName(node.name) : nameFromParent(node);
}

function scopeName(node: ts.Node): string | undefined {
  if (ts.isClassLike(node)) return node.name ? node.name.text : nameFromParent(node);
  const isObjectVariable =
    ts.isVariableDeclaration(node) && node.initializer !== undefined && ts.isObjectLiteralExpression(node.initializer);
  return isObjectVariable ? propertyName((node as ts.VariableDeclaration).name) : undefined;
}

class Collector {
  readonly found: FoundFunction[] = [];
  private readonly counts = new Map<string, number>();

  visit(node: ts.Node, scope: string[]): void {
    let inner = scope;
    if (isFunctionNode(node) && node.body) {
      inner = [...scope, functionName(node)];
      this.record(node, inner.join('.'));
    } else {
      const name = scopeName(node);
      if (name) inner = [...scope, name];
    }
    ts.forEachChild(node, (child) => this.visit(child, inner));
  }

  private record(node: FunctionNode, symbol: string): void {
    const count = (this.counts.get(symbol) ?? 0) + 1;
    this.counts.set(symbol, count);
    this.found.push({ node, symbol: count === 1 ? symbol : `${symbol}#${count}` });
  }
}

export function collectFunctions(sf: ts.SourceFile): FoundFunction[] {
  const collector = new Collector();
  collector.visit(sf, []);
  return collector.found;
}

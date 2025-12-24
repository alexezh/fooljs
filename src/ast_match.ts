import { astEquals, AstNode, ASymbol } from "./ast";

/**
 * Match a pattern against an expression.
 * Returns a map of pattern variable bindings if match succeeds, undefined otherwise.
 *
 * This is a simple pattern matcher that supports:
 * - Pattern variables (?x, ?a, etc.)
 * - Literal values (numbers, symbols)
 * - Function applications with matching argument lists
 * - Spread patterns (?rest...)
 */
export function astMatch(pattern: AstNode, expr: AstNode): Map<string, AstNode> | undefined {
  const bindings = new Map<string, AstNode>();

  if (matchPatternInternal(pattern, expr, bindings)) {
    return bindings;
  }

  return undefined;
}

function matchPatternInternal(pattern: AstNode, expr: AstNode, bindings: Map<string, AstNode>): boolean {
  // Pattern variable: ?x
  if (pattern.kind === 'patvar') {
    const varName = pattern.value.toString();

    // Check if this variable is already bound
    const existing = bindings.get(varName);
    if (existing !== undefined) {
      // Variable must match the same expression
      return astEquals(existing, expr);
    }

    // Bind the variable
    bindings.set(varName, expr);
    return true;
  }

  // Spread pattern: ?rest...
  if (pattern.kind === 'spread') {
    // This case is handled by the parent (function arguments matching)
    // Should not be called directly
    return false;
  }

  // Number: must match exactly
  if (pattern.kind === 'number') {
    return expr.kind === 'number' && pattern.value === expr.value;
  }

  // Symbol: must match name
  if (pattern.kind === 'symbol') {
    if (expr.kind !== 'symbol') return false;
    const patSym = pattern.value as ASymbol;
    const exprSym = expr.value as ASymbol;
    return patSym.name === exprSym.name;
  }

  // Function: must match name and arguments
  if (pattern.kind === 'func') {
    if (expr.kind !== 'func') return false;
    if (pattern.value !== expr.value) return false;

    const patArgs = pattern.children ?? [];
    const exprArgs = expr.children ?? [];

    return matchArgs(patArgs, exprArgs, bindings);
  }

  // Equation: match both sides
  if (pattern.kind === 'eq') {
    if (expr.kind !== 'eq') return false;

    const patArgs = pattern.children ?? [];
    const exprArgs = expr.children ?? [];

    if (patArgs.length !== 2 || exprArgs.length !== 2) return false;

    return matchPatternInternal(patArgs[0], exprArgs[0], bindings) &&
      matchPatternInternal(patArgs[1], exprArgs[1], bindings);
  }

  // List: match elements
  if (pattern.kind === 'list') {
    if (expr.kind !== 'list') return false;

    const patArgs = pattern.children ?? [];
    const exprArgs = expr.children ?? [];

    return matchArgs(patArgs, exprArgs, bindings);
  }

  return false;
}

function matchArgs(patArgs: ReadonlyArray<AstNode>, exprArgs: ReadonlyArray<AstNode>, bindings: Map<string, AstNode>): boolean {
  let pi = 0;
  let ei = 0;

  while (pi < patArgs.length && ei < exprArgs.length) {
    const pat = patArgs[pi];

    // Handle spread pattern: ?rest...
    if (pat.kind === 'spread') {
      const varPat = pat.children?.[0];
      if (!varPat || varPat.kind !== 'patvar') {
        return false; // Invalid spread pattern
      }

      const varName = varPat.value.toString();
      const remainingPatterns = patArgs.length - pi - 1;
      const remainingExprs = exprArgs.length - ei;

      if (remainingExprs < remainingPatterns) {
        return false; // Not enough expressions left
      }

      // Collect the spread items
      const spreadItems: AstNode[] = [];
      const spreadCount = remainingExprs - remainingPatterns;

      for (let i = 0; i < spreadCount; i++) {
        spreadItems.push(exprArgs[ei++]);
      }

      // Bind the spread variable to a list
      bindings.set(varName, AstNode.create('list', 'list', spreadItems));
      pi++;
      continue;
    }

    // Regular pattern
    if (!this.matchPatternInternal(pat, exprArgs[ei], bindings)) {
      return false;
    }

    pi++;
    ei++;
  }

  // Both must be exhausted (unless there are trailing spread patterns)
  return pi === patArgs.length && ei === exprArgs.length;
}

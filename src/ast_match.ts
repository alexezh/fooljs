import { astEquals, AstNode, ASymbol } from "./ast.js";

/**
 * Match a pattern against an expression.
 * Returns a map of pattern variable bindings if match succeeds, undefined otherwise.
 *
 * Supports full grammar:
 * - Pattern variables (?x, ?a, etc.)
 * - Spread patterns (?rest...)
 * - Literal values (numbers, symbols)
 * - Function applications with matching argument lists
 * - Equations (eq)
 * - Lists ([...])
 * - Tuples ((...))
 * - Rules (pattern => replacement)
 * - Indexed symbols (x{i,j})
 */
export function astMatch(pattern: AstNode, expr: AstNode): Map<string, AstNode> | undefined {
  const bindings = new Map<string, AstNode>();

  if (matchPatternInternal(pattern, expr, bindings)) {
    return bindings;
  }

  return undefined;
}

export function astReplace(replace: AstNode, expr: AstNode, bindings: Map<string, AstNode>): AstNode {
}

function matchPatternInternal(pattern: AstNode, expr: AstNode, bindings: Map<string, AstNode>): boolean {
  // Pattern variable: ?x
  if (pattern.kind === 'patvar') {
    const varName = getPatVarName(pattern);

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
    // Should not be called directly at the top level
    return false;
  }

  // Number: must match exactly
  if (pattern.kind === 'number') {
    return expr.kind === 'number' && pattern.value === expr.value;
  }

  // Symbol: must match name and indices
  if (pattern.kind === 'symbol') {
    if (expr.kind !== 'symbol') return false;
    const patSym = pattern.value as ASymbol;
    const exprSym = expr.value as ASymbol;

    // Match name
    if (patSym.name !== exprSym.name) return false;

    // Match indices if present
    const patIndex = patSym.index ?? [];
    const exprIndex = exprSym.index ?? [];

    if (patIndex.length !== exprIndex.length) return false;

    for (let i = 0; i < patIndex.length; i++) {
      if (!matchPatternInternal(patIndex[i], exprIndex[i], bindings)) {
        return false;
      }
    }

    return true;
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

  // Tuple: match elements (similar to list but different kind)
  if (pattern.kind === 'tuple') {
    if (expr.kind !== 'tuple') return false;

    const patArgs = pattern.children ?? [];
    const exprArgs = expr.children ?? [];

    return matchArgs(patArgs, exprArgs, bindings);
  }

  // Rule: match pattern => replacement
  if (pattern.kind === 'rule') {
    if (expr.kind !== 'rule') return false;

    const patChildren = pattern.children ?? [];
    const exprChildren = expr.children ?? [];

    if (patChildren.length !== 2 || exprChildren.length !== 2) return false;

    // Match both pattern and replacement
    return matchPatternInternal(patChildren[0], exprChildren[0], bindings) &&
      matchPatternInternal(patChildren[1], exprChildren[1], bindings);
  }

  // Unknown or unsupported kind
  return false;
}

/**
 * Match argument lists with support for spread patterns.
 * Handles: regular args, spread patterns (?rest...), and combinations.
 */
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

      const varName = getPatVarName(varPat);

      // Check if this spread variable is already bound
      const existing = bindings.get(varName);

      // Calculate how many items this spread should consume
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

      // Create list node for spread items
      const spreadList = AstNode.create('list', 'list', spreadItems);

      // If already bound, verify it matches
      if (existing !== undefined) {
        if (!astEquals(existing, spreadList)) {
          return false;
        }
      } else {
        // Bind the spread variable to a list
        bindings.set(varName, spreadList);
      }

      pi++;
      continue;
    }

    // Regular pattern
    if (!matchPatternInternal(pat, exprArgs[ei], bindings)) {
      return false;
    }

    pi++;
    ei++;
  }

  // Both must be exhausted (unless there are trailing spread patterns)
  // Handle edge case: pattern ends with spread that consumes nothing
  while (pi < patArgs.length) {
    const pat = patArgs[pi];
    if (pat.kind === 'spread') {
      const varPat = pat.children?.[0];
      if (!varPat || varPat.kind !== 'patvar') {
        return false;
      }
      const varName = getPatVarName(varPat);
      const existing = bindings.get(varName);
      const emptyList = AstNode.create('list', 'list', []);

      if (existing !== undefined) {
        if (!astEquals(existing, emptyList)) {
          return false;
        }
      } else {
        bindings.set(varName, emptyList);
      }
      pi++;
    } else {
      return false; // Non-spread pattern left but no more expressions
    }
  }

  return pi === patArgs.length && ei === exprArgs.length;
}

/**
 * Extract the pattern variable name from a patvar node.
 * Handles both string and ASymbol value types.
 */
function getPatVarName(patvar: AstNode): string {
  if (typeof patvar.value === 'string') {
    return patvar.value;
  }
  if (patvar.value instanceof ASymbol) {
    return patvar.value.name;
  }
  if (patvar.value instanceof AstNode) {
    return patvar.value.toString();
  }
  return patvar.value.toString();
}

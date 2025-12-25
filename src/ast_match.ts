import { astEquals, AstNode, ASymbol, FuncName } from "./ast.js";

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

/**
 * Replace pattern variables in a replacement pattern with their bindings.
 *
 * Example:
 *   pattern: sum(?a, ?b)
 *   expr: sum(2, 3)
 *   bindings: {a: 2, b: 3}
 *   replacement: mul(?a, ?b)
 *   result: mul(2, 3)
 */
export function astReplace(replace: AstNode, bindings: Map<string, AstNode>): AstNode {
  return replaceInternal(replace, bindings);
}

function replaceInternal(node: AstNode, bindings: Map<string, AstNode>): AstNode {
  // Pattern variable: substitute with bound value
  if (node.kind === 'patvar') {
    const varName = getPatVarName(node);
    const bound = bindings.get(varName);

    if (bound === undefined) {
      throw new Error(`Unbound pattern variable: ${varName}`);
    }

    return bound;
  }

  // Spread pattern: handled by parent during children processing
  if (node.kind === 'spread') {
    throw new Error('Spread patterns should be handled by parent node');
  }

  // Literal values: return as-is
  if (node.kind === 'number') {
    return node;
  }

  // Symbol: replace indices if they contain pattern variables
  if (node.kind === 'symbol') {
    const sym = node.value as ASymbol;
    const oldIndex = sym.index ?? [];

    if (oldIndex.length === 0) {
      return node; // No indices, return as-is
    }

    // Replace any pattern variables in indices
    const newIndex = oldIndex.map(idx => replaceInternal(idx, bindings));

    // Check if anything changed
    if (newIndex.every((idx, i) => idx === oldIndex[i])) {
      return node; // No changes
    }

    // Create new symbol with replaced indices
    const newSym = new ASymbol(sym.name, newIndex);
    return AstNode.create('symbol', newSym);
  }

  // Function: replace arguments
  if (node.kind === 'func') {
    const oldChildren = node.children ?? [];
    const newChildren = replaceChildren(oldChildren, bindings);

    if (newChildren === oldChildren) {
      return node; // No changes
    }

    return AstNode.create('func', node.value as FuncName, newChildren);
  }

  // Equation: replace both sides
  if (node.kind === 'eq') {
    const oldChildren = node.children ?? [];

    if (oldChildren.length !== 2) {
      return node;
    }

    const left = replaceInternal(oldChildren[0], bindings);
    const right = replaceInternal(oldChildren[1], bindings);

    if (left === oldChildren[0] && right === oldChildren[1]) {
      return node; // No changes
    }

    return AstNode.create('eq', 'eq', [left, right]);
  }

  // List: replace elements
  if (node.kind === 'list') {
    const oldChildren = node.children ?? [];
    const newChildren = replaceChildren(oldChildren, bindings);

    if (newChildren === oldChildren) {
      return node; // No changes
    }

    return AstNode.create('list', 'list', newChildren);
  }

  // Tuple: replace elements
  if (node.kind === 'tuple') {
    const oldChildren = node.children ?? [];
    const newChildren = replaceChildren(oldChildren, bindings);

    if (newChildren === oldChildren) {
      return node; // No changes
    }

    return AstNode.create('tuple', 'tuple', newChildren);
  }

  // Rule: replace both pattern and replacement
  if (node.kind === 'rule') {
    const oldChildren = node.children ?? [];

    if (oldChildren.length !== 2) {
      return node;
    }

    const pattern = replaceInternal(oldChildren[0], bindings);
    const replacement = replaceInternal(oldChildren[1], bindings);

    if (pattern === oldChildren[0] && replacement === oldChildren[1]) {
      return node; // No changes
    }

    return AstNode.create('rule', 'rule', [pattern, replacement]);
  }

  // Unknown kind: return as-is
  return node;
}

/**
 * Replace children, handling spread patterns by expanding them.
 */
function replaceChildren(children: ReadonlyArray<AstNode>, bindings: Map<string, AstNode>): AstNode[] {
  const result: AstNode[] = [];
  let changed = false;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    // Handle spread pattern: expand the bound list
    if (child.kind === 'spread') {
      const varPat = child.children?.[0];

      if (!varPat || varPat.kind !== 'patvar') {
        throw new Error('Invalid spread pattern in replacement');
      }

      const varName = getPatVarName(varPat);
      const bound = bindings.get(varName);

      if (bound === undefined) {
        throw new Error(`Unbound spread variable: ${varName}`);
      }

      // Spread variable should be bound to a list
      if (bound.kind !== 'list') {
        throw new Error(`Spread variable ${varName} is not bound to a list`);
      }

      const spreadItems = bound.children ?? [];
      result.push(...spreadItems);
      changed = true;
    } else {
      // Regular child: replace recursively
      const replaced = replaceInternal(child, bindings);
      result.push(replaced);

      if (replaced !== child) {
        changed = true;
      }
    }
  }

  // Return original if nothing changed (to allow === comparison)
  return changed ? result : children as AstNode[];
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

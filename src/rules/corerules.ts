import { AstNode, ASymbol, FuncName, MatchFuncRet } from "../ast.js";

// Helper to check if node is a number
export function isNumber(node: AstNode): boolean {
  return node.kind === 'number';
}

// Helper to check if node is a symbol
export function isSymbol(node: AstNode): boolean {
  return node.kind === 'symbol';
}

// Helper to check if node is a func with specific name
export function isFunc(node: AstNode, name: string): boolean {
  return node.kind === 'func' && node.value === name;
}

// Helper to get function args
export function getArgs(node: AstNode): ReadonlyArray<AstNode> {
  return node.children ?? [];
}

// Helper to check if all nodes are equal
export function allEqual(nodes: ReadonlyArray<AstNode>): boolean {
  if (nodes.length === 0) return true;
  const first = nodes[0];
  for (let i = 1; i < nodes.length; i++) {
    if (first.kind !== nodes[i].kind) return false;
    if (first.kind === 'number' && nodes[i].kind === 'number') {
      if (first.value !== nodes[i].value) return false;
    } else if (first.kind === 'symbol' && nodes[i].kind === 'symbol') {
      const firstSym = first.value as ASymbol;
      const nodeSym = nodes[i].value as ASymbol;
      if (firstSym.name !== nodeSym.name) return false;
    } else {
      if (first.toString() !== nodes[i].toString()) return false;
    }
  }
  return true;
}


// paren(?a) => ?a
export function ruleParenRemove(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'paren')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  return {
    replace: args[0],
    cost: 0 // No new nodes, just unwrapping
  };
}

// =============================================================================
// Equation (eq) rules
// =============================================================================

// eq(?a, ?b) => eq(?b, ?a) - Symmetry
export function ruleEqSymmetry(ast: AstNode): MatchFuncRet | undefined {
  if (ast.kind !== 'eq') return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return {
    replace: AstNode.create('eq', 'eq', [b, a]),
    cost: 1 // Creates 1 new eq node
  };
}

// eq(?a, ?b) => eq(sum(?a, neg(?b)), 0) - Normalize to zero form
export function ruleEqNormalize(ast: AstNode): MatchFuncRet | undefined {
  if (ast.kind !== 'eq') return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;

  // Don't normalize if already in form eq(..., 0)
  if (isNumber(b) && b.value === 0) return undefined;

  return {
    replace: AstNode.create('eq', 'eq', [
      AstNode.create('func', 'sum', [a, AstNode.create('func', 'neg', [b])]),
      AstNode.create('number', 0)
    ]),
    cost: 4 // Creates 4 new nodes: eq, sum, neg, and number 0
  };
}

// eval(eq(?a, ?b)) => eq(eval(?a), eval(?b))
// Evaluate both sides of an equation independently
export function ruleEvalEq(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const eqNode = args[0];
  if (eqNode.kind !== 'eq') return undefined;

  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [left, right] = eqArgs;
  return {
    replace: AstNode.create('eq', 'eq', [
      AstNode.create('func', 'eval', [left]),
      AstNode.create('func', 'eval', [right])
    ]),
    cost: 3 // Creates 3 new nodes: eq and 2 eval nodes
  };
}

// eq(?a, ?b) => eq(sum(?a, ?c), sum(?b, ?c)) - Add to both sides
// Note: This is a meta-rule template; in practice we'd need ?c to be provided
// For now, this returns undefined as it needs additional context
export function ruleEqAddBothSides(ast: AstNode): MatchFuncRet | undefined {
  // This is a template rule - actual implementation would need the term to add
  return undefined;
}

// eq(?a, ?b) => eq(mul(?k, ?a), mul(?k, ?b)) - Multiply both sides
// Similar to above, needs the multiplier
export function ruleEqMulBothSides(ast: AstNode): MatchFuncRet | undefined {
  return undefined;
}

// solve(?e, ?p) => solve(?e1, ?p) where not holds(?p, ?e), step(?e) => ?e1
// Recursive case: take one step and continue solving
// Note: This needs runtime access for step function
export function ruleSolveStep(ast: AstNode): MatchFuncRet | undefined {
  // This will be implemented when we have runtime access in rules
  return undefined;
}

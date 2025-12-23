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

// eq(sum(?t, ?c), ?rhs) => eq(?t, sum(?rhs, neg(?c)))
// Move addend from left side to right side
export function ruleEqMoveAddendGeneral(ast: AstNode): MatchFuncRet | undefined {
  if (ast.kind !== 'eq') return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [lhs, rhs] = args;

  // Check if lhs is sum with at least 2 args
  if (!isFunc(lhs, 'sum')) return undefined;
  const sumArgs = getArgs(lhs);
  if (sumArgs.length < 2) return undefined;

  // Take the last argument as ?c and the rest as ?t
  const c = sumArgs[sumArgs.length - 1];
  const tArgs = sumArgs.slice(0, -1);

  // Build ?t (if single arg, unwrap; otherwise keep as sum)
  const t = tArgs.length === 1
    ? tArgs[0]
    : AstNode.create('func', 'sum', tArgs);

  // Build eq(?t, sum(?rhs, neg(?c)))
  const newRhs = AstNode.create('func', 'sum', [
    rhs,
    AstNode.create('func', 'neg', [c])
  ]);

  return {
    replace: AstNode.create('eq', 'eq', [t, newRhs]),
    cost: 3 // Creates 3 new nodes: eq, sum, neg
  };
}

// eq(mul(?k, ?x), ?b) => eq(?x, div(?b, ?k))
// Divide both sides when left side is a multiplication
export function ruleEqDivideBothSidesLeftMul(ast: AstNode): MatchFuncRet | undefined {
  if (ast.kind !== 'eq') return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [lhs, rhs] = args;

  // Check if lhs is mul with at least 2 args
  if (!isFunc(lhs, 'mul')) return undefined;
  const mulArgs = getArgs(lhs);
  if (mulArgs.length < 2) return undefined;

  // Take the first argument as ?k and the rest as ?x
  const k = mulArgs[0];
  const xArgs = mulArgs.slice(1);

  // Build ?x (if single arg, unwrap; otherwise keep as mul)
  const x = xArgs.length === 1
    ? xArgs[0]
    : AstNode.create('func', 'mul', xArgs);

  // Build eq(?x, div(?b, ?k))
  const newRhs = AstNode.create('func', 'div', [rhs, k]);

  return {
    replace: AstNode.create('eq', 'eq', [x, newRhs]),
    cost: 2 // Creates 2 new nodes: eq, div
  };
}

// eq(?b, mul(?k, ?x)) => eq(div(?b, ?k), ?x)
// Divide both sides when right side is a multiplication
export function ruleEqDivideBothSidesRightMul(ast: AstNode): MatchFuncRet | undefined {
  if (ast.kind !== 'eq') return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [lhs, rhs] = args;

  // Check if rhs is mul with at least 2 args
  if (!isFunc(rhs, 'mul')) return undefined;
  const mulArgs = getArgs(rhs);
  if (mulArgs.length < 2) return undefined;

  // Take the first argument as ?k and the rest as ?x
  const k = mulArgs[0];
  const xArgs = mulArgs.slice(1);

  // Build ?x (if single arg, unwrap; otherwise keep as mul)
  const x = xArgs.length === 1
    ? xArgs[0]
    : AstNode.create('func', 'mul', xArgs);

  // Build eq(div(?b, ?k), ?x)
  const newLhs = AstNode.create('func', 'div', [lhs, k]);

  return {
    replace: AstNode.create('eq', 'eq', [newLhs, x]),
    cost: 2 // Creates 2 new nodes: eq, div
  };
}

// solve(?e, ?p) => solve(?e1, ?p) where not holds(?p, ?e), step(?e) => ?e1
// Recursive case: take one step and continue solving
// Note: This needs runtime access for step function
export function ruleSolveStep(ast: AstNode): MatchFuncRet | undefined {
  // This will be implemented when we have runtime access in rules
  return undefined;
}

import { AstNode, ASymbol, FuncName } from "../ast.js";

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
export function ruleParenRemove(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'paren')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  return args[0];
}

// =============================================================================
// Equation (eq) rules
// =============================================================================

// eq(?a, ?b) => eq(?b, ?a) - Symmetry
export function ruleEqSymmetry(ast: AstNode): AstNode | undefined {
  if (ast.kind !== 'eq') return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return AstNode.create('eq', 'eq', [b, a]);
}

// eq(?a, ?b) => eq(sum(?a, ?c), sum(?b, ?c)) - Add to both sides
// Note: This is a meta-rule template; in practice we'd need ?c to be provided
// For now, this returns undefined as it needs additional context
export function ruleEqAddBothSides(ast: AstNode): AstNode | undefined {
  // This is a template rule - actual implementation would need the term to add
  return undefined;
}

// eq(?a, ?b) => eq(mul(?k, ?a), mul(?k, ?b)) - Multiply both sides
// Similar to above, needs the multiplier
export function ruleEqMulBothSides(ast: AstNode): AstNode | undefined {
  return undefined;
}

// solve(?e, ?p) => solve(?e1, ?p) where not holds(?p, ?e), step(?e) => ?e1
// Recursive case: take one step and continue solving
// Note: This needs runtime access for step function
export function ruleSolveStep(ast: AstNode): AstNode | undefined {
  // This will be implemented when we have runtime access in rules
  return undefined;
}

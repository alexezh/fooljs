import { AstNode, ASymbol, FuncName } from "./ast.js";
import { Runtime } from "./runtime.js";

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

// sum(?a, ?b, ?rest...) => sum(sum(?a, ?b), ?rest...)
export function ruleAssocLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 3) return undefined;

  const [a, b, ...rest] = args;
  return AstNode.create('func', 'sum', [
    AstNode.create('func', 'sum', [a, b]),
    ...rest
  ]);
}

// sum(?a, ?b, ?c, ?rest...) => sum(sum(?a, ?c), ?b, ?rest...)
export function ruleAssocMid(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 3) return undefined;

  const [a, b, c, ...rest] = args;
  return AstNode.create('func', 'sum', [
    AstNode.create('func', 'sum', [a, c]),
    b,
    ...rest
  ]);
}

// sum(?a, ?b) => sum(?b, ?a)
export function ruleCommutative(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return AstNode.create('func', 'sum', [b, a]);
}

// sum(?a, ?mid..., ?c) => sum(?c, ?mid..., ?a) - Swap first and last
export function ruleSwapEnds(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  const first = args[0];
  const last = args[args.length - 1];
  const middle = args.slice(1, -1);

  return AstNode.create('func', 'sum', [last, ...middle, first]);
}

// sum(?args..., 0, ?rest...) => sum(?args..., ?rest...) - Remove any zeros
export function ruleNeutralRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Find first zero
  const zeroIndex = args.findIndex(arg => isNumber(arg) && arg.value === 0);
  if (zeroIndex === -1) return undefined;

  // Remove the zero
  const newArgs = [...args.slice(0, zeroIndex), ...args.slice(zeroIndex + 1)];

  // If only one arg left, return it
  if (newArgs.length === 1) return newArgs[0];

  // Otherwise return sum of remaining args
  return AstNode.create('func', 'sum', newArgs);
}

// Deprecated: merged into ruleNeutralRight
export function ruleNeutralLeft(ast: AstNode): AstNode | undefined {
  // Just redirect to ruleNeutralRight which now handles zeros anywhere
  return ruleNeutralRight(ast);
}

// sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name
export function ruleLiftSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  // This rule requires a fresh symbol name - skip for now as it needs context
  // We'd need a way to generate fresh symbol names
  return undefined;
}

// eval(?n) => ?n where ?n is number
export function ruleEvalNumber(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const n = args[0];
  if (!isNumber(n)) return undefined;

  return n;
}

// eval(sym(?x)) => sym(?x) where ?x is symbol_name
export function ruleEvalSymbol(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isFunc(arg, 'sym')) return undefined;

  const symArgs = getArgs(arg);
  if (symArgs.length !== 1) return undefined;
  if (!isSymbol(symArgs[0])) return undefined;

  return arg;
}

// eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name
export function ruleEvalProgressive(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const funcCall = args[0];
  if (funcCall.kind !== 'func') return undefined;

  const funcArgs = getArgs(funcCall);
  if (funcArgs.length === 0) return undefined;

  const [first, ...rest] = funcArgs;

  // Create eval(?f(eval(?a), ?rest...))
  return AstNode.create('func', 'eval', [
    AstNode.create('func', funcCall.value as FuncName, [
      AstNode.create('func', 'eval', [first]),
      ...rest
    ])
  ]);
}

// eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name
export function ruleEvalDef(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const defCall = args[0];
  if (!isFunc(defCall, 'def')) return undefined;

  const defArgs = getArgs(defCall);
  if (defArgs.length !== 2) return undefined;

  const [sym, expr] = defArgs;
  if (!isFunc(sym, 'sym')) return undefined;

  const symArgs = getArgs(sym);
  if (symArgs.length !== 1) return undefined;
  if (!isSymbol(symArgs[0])) return undefined;

  return AstNode.create('func', 'def', [
    sym,
    AstNode.create('func', 'eval', [expr])
  ]);
}

// eval(def(sym(?y), ?e)) => eval(?e) where ?y is symbol_name
export function ruleEvalDefSimplify(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const defCall = args[0];
  if (!isFunc(defCall, 'def')) return undefined;

  const defArgs = getArgs(defCall);
  if (defArgs.length !== 2) return undefined;

  const [sym, expr] = defArgs;
  if (!isFunc(sym, 'sym')) return undefined;

  const symArgs = getArgs(sym);
  if (symArgs.length !== 1) return undefined;
  if (!isSymbol(symArgs[0])) return undefined;

  return AstNode.create('func', 'eval', [expr]);
}

// eval(sum(?a, ?b)) => calc_sum(?a, ?b) where ?a is number, ?b is number
export function ruleEvalSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const sumCall = args[0];
  if (!isFunc(sumCall, 'sum')) return undefined;

  const sumArgs = getArgs(sumCall);
  if (sumArgs.length !== 2) return undefined;

  const [a, b] = sumArgs;
  if (!isNumber(a) || !isNumber(b)) return undefined;

  const result = (a.value as number) + (b.value as number);
  return AstNode.create('number', result);
}

// eval(mul(?a, ?b)) => calc_mul(?a, ?b) where ?a is number, ?b is number
export function ruleEvalMul(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const mulCall = args[0];
  if (!isFunc(mulCall, 'mul')) return undefined;

  const mulArgs = getArgs(mulCall);
  if (mulArgs.length !== 2) return undefined;

  const [a, b] = mulArgs;
  if (!isNumber(a) || !isNumber(b)) return undefined;

  const result = (a.value as number) * (b.value as number);
  return AstNode.create('number', result);
}

// eval(div(?a, ?b)) => calc_div(?a, ?b) where ?a is number, ?b is number, ?b != 0
export function ruleEvalDiv(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const divCall = args[0];
  if (!isFunc(divCall, 'div')) return undefined;

  const divArgs = getArgs(divCall);
  if (divArgs.length !== 2) return undefined;

  const [a, b] = divArgs;
  if (!isNumber(a) || !isNumber(b)) return undefined;
  if (b.value === 0) return undefined; // Don't divide by zero

  const result = (a.value as number) / (b.value as number);
  return AstNode.create('number', result);
}

// eval(neg(?a)) => calc_neg(?a) where ?a is number
export function ruleEvalNeg(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const negCall = args[0];
  if (!isFunc(negCall, 'neg')) return undefined;

  const negArgs = getArgs(negCall);
  if (negArgs.length !== 1) return undefined;

  const a = negArgs[0];
  if (!isNumber(a)) return undefined;

  const result = -(a.value as number);
  return AstNode.create('number', result);
}

// mul(?a, ?b, ?rest...) => mul(mul(?a, ?b), ?rest...)
export function ruleMulAssocLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length < 3) return undefined;

  const [a, b, ...rest] = args;
  return AstNode.create('func', 'mul', [
    AstNode.create('func', 'mul', [a, b]),
    ...rest
  ]);
}

// mul(?a, ?b) => mul(?b, ?a)
export function ruleMulCommutative(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return AstNode.create('func', 'mul', [b, a]);
}

// mul(?args..., 1, ?rest...) => mul(?args..., ?rest...) - Remove any ones
export function ruleMulNeutralRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Find first one
  const oneIndex = args.findIndex(arg => isNumber(arg) && arg.value === 1);
  if (oneIndex === -1) return undefined;

  // Remove the one
  const newArgs = [...args.slice(0, oneIndex), ...args.slice(oneIndex + 1)];

  // If only one arg left, return it
  if (newArgs.length === 1) return newArgs[0];

  // Otherwise return mul of remaining args
  return AstNode.create('func', 'mul', newArgs);
}

// Deprecated: merged into ruleMulNeutralRight
export function ruleMulNeutralLeft(ast: AstNode): AstNode | undefined {
  // Just redirect to ruleMulNeutralRight which now handles ones anywhere
  return ruleMulNeutralRight(ast);
}

// mul(?args..., 0, ?rest...) => 0 - Any zero makes the whole product zero
export function ruleMulZeroRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Find any zero
  const hasZero = args.some(arg => isNumber(arg) && arg.value === 0);
  if (!hasZero) return undefined;

  return AstNode.create('number', 0);
}

// Deprecated: merged into ruleMulZeroRight
export function ruleMulZeroLeft(ast: AstNode): AstNode | undefined {
  // Just redirect to ruleMulZeroRight which now handles zeros anywhere
  return ruleMulZeroRight(ast);
}

// div(?a, 1) => ?a
export function ruleDivNeutralRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'div')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  if (!isNumber(b) || b.value !== 1) return undefined;

  return a;
}

// div(?a, ?a) => 1
export function ruleDivSelfToOne(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'div')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  // Check if both arguments are identical
  if (a.kind !== b.kind) return undefined;

  if (a.kind === 'number' && b.kind === 'number') {
    if (a.value !== b.value || a.value === 0) return undefined;
    return AstNode.create('number', 1);
  } else if (a.kind === 'symbol' && b.kind === 'symbol') {
    const aSym = a.value as ASymbol;
    const bSym = b.value as ASymbol;
    if (aSym.name !== bSym.name) return undefined;
    return AstNode.create('number', 1);
  }

  return undefined;
}

// paren(?a) => ?a
export function ruleParenRemove(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'paren')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  return args[0];
}

// sub(?a, ?b) => add(?a, neg(?b))
export function ruleSubToSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sub')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return AstNode.create('func', 'sum', [
    a,
    AstNode.create('func', 'neg', [b])
  ]);
}

// neg(neg(?a)) => ?a
export function ruleDoubleNeg(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'neg')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'neg')) return undefined;

  const innerArgs = getArgs(inner);
  if (innerArgs.length !== 1) return undefined;

  return innerArgs[0];
}

// neg(0) => 0
export function ruleNegZero(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'neg')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isNumber(arg) || arg.value !== 0) return undefined;

  return AstNode.create('number', 0);
}

// add(?a, neg(?a)) => 0
export function ruleSumNegSelf(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;

  // Check if b is neg(a)
  if (isFunc(b, 'neg')) {
    const negArgs = getArgs(b);
    if (negArgs.length === 1) {
      if (a.toString() === negArgs[0].toString()) {
        return AstNode.create('number', 0);
      }
    }
  }

  return undefined;
}

// sum(?a, ?rest...) => mul(count([?a, ?rest...]), ?a)
// where ?a is number, ?rest is number, all_equal(?a, ?rest...)
export function ruleSumToMul(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Check all args are numbers
  for (const arg of args) {
    if (!isNumber(arg)) return undefined;
  }

  // Check all args are equal
  if (!allEqual(args)) return undefined;

  const value = args[0];
  const count = args.length;

  return AstNode.create('func', 'mul', [
    AstNode.create('number', count),
    value
  ]);
}

// mul(?n, ?a) => sum(?a, ?a, ...) where ?n is number (inverse of sum->mul)
// This expands multiplication by a small constant into repeated addition
export function ruleMulToSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [n, a] = args;
  if (!isNumber(n)) return undefined;

  const count = n.value as number;
  if (count < 2 || count > 10) return undefined; // Only expand for small counts

  // Create sum with 'count' copies of 'a'
  const sumArgs = Array(count).fill(a);
  return AstNode.create('func', 'sum', sumArgs);
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

// =============================================================================
// Solve + eq rules - Equation solving
// =============================================================================

// solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))
// Normalize equation to form: something = 0
export function ruleSolveEqNormalize(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;

  // Check first arg is eq(?lhs, ?rhs)
  if (eqNode.kind !== 'eq') return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Don't normalize if already in form eq(..., 0)
  if (isNumber(rhs) && rhs.value === 0) return undefined;

  // Normalize: eq(lhs, rhs) => eq(lhs - rhs, 0)
  const normalized = AstNode.create('eq', 'eq', [
    AstNode.create('func', 'sub', [lhs, rhs]),
    AstNode.create('number', 0)
  ]);

  return AstNode.create('func', 'solve', [normalized, goalNode]);
}

// solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs
// Base case: variable isolated on left
export function ruleSolveEqIsolatedLeft(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;
  const goalArgs = getArgs(goalNode);
  if (goalArgs.length !== 1) return undefined;
  const targetVar = goalArgs[0];

  // Check first arg is eq(?x, ?rhs)
  if (eqNode.kind !== 'eq') return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Check if lhs matches the target variable
  if (lhs.kind === 'symbol' && targetVar.kind === 'symbol') {
    const lhsSym = lhs.value as ASymbol;
    const targetSym = targetVar.value as ASymbol;
    if (lhsSym.name === targetSym.name) {
      return rhs;
    }
  }

  return undefined;
}


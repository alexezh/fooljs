import { AstNode, ASymbol, isNumber } from "../ast.js";
import { allEqual, getArgs, isFunc } from "./corerules.js";

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

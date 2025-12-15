import { AstNode, isFunc, isNumber } from "../ast.js";
import { getArgs } from "./corerules.js";

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

// sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name
export function ruleLiftSum(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  // This rule requires a fresh symbol name - skip for now as it needs context
  // We'd need a way to generate fresh symbol names
  return undefined;
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
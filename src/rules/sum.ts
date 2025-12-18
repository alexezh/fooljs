import { AstNode, isFunc, isNumber, MatchFuncRet } from "../ast.js";
import { getArgs } from "./corerules.js";

// sum(?a, ?b, ?rest...) => sum(sum(?a, ?b), ?rest...)
export function ruleAssocLeft(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 3) return undefined;

  const [a, b, ...rest] = args;
  return {
    replace: AstNode.create('func', 'sum', [
      AstNode.create('func', 'sum', [a, b]),
      ...rest
    ]),
    cost: 2 // Creates 2 new nodes: outer sum and inner sum
  };
}

// sum(?a, ?b, ?c, ?rest...) => sum(sum(?a, ?c), ?b, ?rest...)
export function ruleAssocMid(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 3) return undefined;

  const [a, b, c, ...rest] = args;
  return {
    replace: AstNode.create('func', 'sum', [
      AstNode.create('func', 'sum', [a, c]),
      b,
      ...rest
    ],
      ast.constraints),
    cost: 2
  };
}

// sum(?a, ?mid..., ?b) => sum(eval(sum(?a, ?b)), ?rest...)
export function ruleAssocEnd(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 3) return undefined;

  const [a, b, c, ...rest] = args;
  return {
    replace: AstNode.create('func', 'sum', [
      AstNode.create('func', 'sum', [a, c]),
      b,
      ...rest
    ]),
    cost: 2 // Creates 2 new nodes: outer sum and inner sum
  };
}

// sum(?a, ?b) => sum(?b, ?a)
export function ruleCommutative(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return {
    replace: AstNode.create('func', 'sum', [b, a]),
    cost: 1 // Creates 1 new node: swapped sum
  };
}

// sum(?a, ?mid..., ?c) => sum(?c, ?mid..., ?a) - Swap first and last
export function ruleSwapEnds(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  const first = args[0];
  const last = args[args.length - 1];
  const middle = args.slice(1, -1);

  return {
    replace: AstNode.create('func', 'sum', [last, ...middle, first]),
    cost: 1 // Creates 1 new node: reordered sum
  };
}

// sum(?args..., 0, ?rest...) => sum(?args..., ?rest...) - Remove any zeros
export function ruleNeutralRight(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Find first zero
  const zeroIndex = args.findIndex(arg => isNumber(arg) && arg.value === 0);
  if (zeroIndex === -1) return undefined;

  // Remove the zero
  const newArgs = [...args.slice(0, zeroIndex), ...args.slice(zeroIndex + 1)];

  // If only one arg left, return it
  if (newArgs.length === 1) {
    return {
      replace: newArgs[0],
      cost: 0 // No new nodes, just unwrapping
    };
  }

  // Otherwise return sum of remaining args
  return {
    replace: AstNode.create('func', 'sum', newArgs),
    cost: 1 // Creates 1 new sum node
  };
}

// sum(?a, ?b) => eval(def(sym(?y), sum(?a, ?b))) where ?y is symbol_name
export function ruleLiftSum(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  // This rule requires a fresh symbol name - skip for now as it needs context
  // We'd need a way to generate fresh symbol names
  return undefined;
}


// sub(?a, ?b) => add(?a, neg(?b))
export function ruleSubToSum(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sub')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;
  return {
    replace: AstNode.create('func', 'sum', [
      a,
      AstNode.create('func', 'neg', [b])
    ]),
    cost: 2 // Creates 2 new nodes: sum and neg
  };
}

// neg(neg(?a)) => ?a
export function ruleDoubleNeg(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'neg')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'neg')) return undefined;

  const innerArgs = getArgs(inner);
  if (innerArgs.length !== 1) return undefined;

  return {
    replace: innerArgs[0],
    cost: 0 // No new nodes, just unwrapping
  };
}

// neg(0) => 0
export function ruleNegZero(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'neg')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const arg = args[0];
  if (!isNumber(arg) || arg.value !== 0) return undefined;

  return {
    replace: AstNode.create('number', 0),
    cost: 1 // Creates 1 new number node
  };
}

// add(?a, neg(?a)) => 0
export function ruleSumNegSelf(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [a, b] = args;

  // Check if b is neg(a)
  if (isFunc(b, 'neg')) {
    const negArgs = getArgs(b);
    if (negArgs.length === 1) {
      if (a.toString() === negArgs[0].toString()) {
        return {
          replace: AstNode.create('number', 0),
          cost: 1 // Creates 1 new number node
        };
      }
    }
  }

  return undefined;
}
// =============================================================================
// Generic fold and accumulator patterns
// =============================================================================

import { AstNode, FuncName, isNumber, MatchFuncRet } from "../ast.js";
import { getArgs, isFunc } from "./corerules.js";

// =============================================================================
// Generic fold over a list
// =============================================================================

// fold(?f, ?acc, []) => ?acc
// Base case: empty list returns accumulator
export function ruleFoldBase(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'fold')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 3) return undefined;

  const [_f, acc, list] = args;

  // Check if list is empty
  if (list.kind !== 'list') return undefined;
  const listItems = getArgs(list);
  if (listItems.length !== 0) return undefined;

  return {
    replace: acc,
    cost: 0 // No new nodes, just unwrapping
  };
}

// fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])
// Recursive case: apply function to accumulator and first element
export function ruleFoldStep(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'fold')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 3) return undefined;

  const [f, acc, list] = args;

  // Check if list has at least one element
  if (list.kind !== 'list') return undefined;
  const listItems = getArgs(list);
  if (listItems.length === 0) return undefined;

  const [first, ...rest] = listItems;

  // Build f(acc, first)
  const newAcc = AstNode.create('func', f.value as FuncName, [acc, first]);

  // Build fold(f, newAcc, rest)
  return {
    replace: AstNode.create('func', 'fold', [
      f,
      newAcc,
      AstNode.create('list', 'list', rest)
    ]),
    cost: 4 // Creates 4 new nodes: fold, f application, and list
  };
}

// =============================================================================
// Accumulator for sum: acc([rest...], total)
// =============================================================================

// collect_sum_numbers(acc([?rest...], ?total), ?n)
//   => acc([?rest...], sum(?total, ?n))
//   where ?n is number
export function ruleCollectSumNumber(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'collect_sum_numbers')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [accNode, element] = args;

  // Check if element is a number
  if (!isNumber(element)) return undefined;

  // Check if accNode is acc([...], total)
  if (!isFunc(accNode, 'acc')) return undefined;
  const accArgs = getArgs(accNode);
  if (accArgs.length !== 2) return undefined;

  const [restList, total] = accArgs;
  if (restList.kind !== 'list') return undefined;

  // Build new accumulator: acc([rest...], sum(total, n))
  return {
    replace: AstNode.create('func', 'acc', [
      restList,
      AstNode.create('func', 'sum', [total, element])
    ]),
    cost: 3 // Creates 3 new nodes: acc, sum
  };
}

// collect_sum_numbers(acc([?rest...], ?total), ?e)
//   => acc([?rest..., ?e], ?total)
//   where ?e is not number
export function ruleCollectSumNonNumber(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'collect_sum_numbers')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [accNode, element] = args;

  // Check if element is NOT a number
  if (isNumber(element)) return undefined;

  // Check if accNode is acc([...], total)
  if (!isFunc(accNode, 'acc')) return undefined;
  const accArgs = getArgs(accNode);
  if (accArgs.length !== 2) return undefined;

  const [restList, total] = accArgs;
  if (restList.kind !== 'list') return undefined;

  const restItems = getArgs(restList);

  // Build new accumulator: acc([rest..., e], total)
  return {
    replace: AstNode.create('func', 'acc', [
      AstNode.create('list', 'list', [...restItems, element]),
      total
    ]),
    cost: 2 // Creates 2 new nodes: acc and list
  };
}

// =============================================================================
// Sum folding rule
// =============================================================================

// sum(?args...) => sum(?rest..., ?total)
// where fold(collect_sum_numbers, acc([], 0), [?args...]) => acc([?rest...], ?total)
export function ruleSumFold(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Build fold(collect_sum_numbers, acc([], 0), [args...])
  const foldExpr = AstNode.create('func', 'fold', [
    AstNode.create('func', 'collect_sum_numbers', []),
    AstNode.create('func', 'acc', [
      AstNode.create('list', 'list', []),
      AstNode.create('number', 0)
    ]),
    AstNode.create('list', 'list', Array.from(args))
  ]);

  // Note: In practice, this would need to be evaluated by the runtime
  // For now, we return a transformation that sets up the fold
  return {
    replace: foldExpr,
    cost: 5 // Creates 5 new nodes: fold, collect_sum_numbers, acc, empty list, number 0, args list
  };
}

// =============================================================================
// Accumulator for multiplication: acc([rest...], product)
// =============================================================================

// collect_mul_numbers(acc([?rest...], ?product), ?n)
//   => acc([?rest...], mul(?product, ?n))
//   where ?n is number
export function ruleCollectMulNumber(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'collect_mul_numbers')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [accNode, element] = args;

  // Check if element is a number
  if (!isNumber(element)) return undefined;

  // Check if accNode is acc([...], product)
  if (!isFunc(accNode, 'acc')) return undefined;
  const accArgs = getArgs(accNode);
  if (accArgs.length !== 2) return undefined;

  const [restList, product] = accArgs;
  if (restList.kind !== 'list') return undefined;

  // Build new accumulator: acc([rest...], mul(product, n))
  return {
    replace: AstNode.create('func', 'acc', [
      restList,
      AstNode.create('func', 'mul', [product, element])
    ]),
    cost: 3 // Creates 3 new nodes: acc, mul
  };
}

// collect_mul_numbers(acc([?rest...], ?product), ?e)
//   => acc([?rest..., ?e], ?product)
//   where ?e is not number
export function ruleCollectMulNonNumber(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'collect_mul_numbers')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [accNode, element] = args;

  // Check if element is NOT a number
  if (isNumber(element)) return undefined;

  // Check if accNode is acc([...], product)
  if (!isFunc(accNode, 'acc')) return undefined;
  const accArgs = getArgs(accNode);
  if (accArgs.length !== 2) return undefined;

  const [restList, product] = accArgs;
  if (restList.kind !== 'list') return undefined;

  const restItems = getArgs(restList);

  // Build new accumulator: acc([rest..., e], product)
  return {
    replace: AstNode.create('func', 'acc', [
      AstNode.create('list', 'list', [...restItems, element]),
      product
    ]),
    cost: 2 // Creates 2 new nodes: acc and list
  };
}

// mul(?args...) => mul(?rest..., ?product)
// where fold(collect_mul_numbers, acc([], 1), [?args...]) => acc([?rest...], ?product)
export function ruleMulFold(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'mul')) return undefined;
  const args = getArgs(ast);
  if (args.length < 2) return undefined;

  // Build fold(collect_mul_numbers, acc([], 1), [args...])
  const foldExpr = AstNode.create('func', 'fold', [
    AstNode.create('func', 'collect_mul_numbers', []),
    AstNode.create('func', 'acc', [
      AstNode.create('list', 'list', []),
      AstNode.create('number', 1)
    ]),
    AstNode.create('list', 'list', Array.from(args))
  ]);

  return {
    replace: foldExpr,
    cost: 5 // Creates 5 new nodes: fold, collect_mul_numbers, acc, empty list, number 1, args list
  };
}

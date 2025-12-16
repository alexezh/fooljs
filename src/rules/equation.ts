// solve(eq(?lhs, ?x), solved_for(?x)) => ?lhs

import { AstNode, ASymbol, isNumber } from "../ast.js";
import { getArgs, isFunc } from "./corerules.js";

// Base case: variable isolated on right
export function ruleSolveEqIsolatedRight(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;
  const goalArgs = getArgs(goalNode);
  if (goalArgs.length !== 1) return undefined;
  const targetVar = goalArgs[0];

  // Check first arg is eq(?lhs, ?x)
  if (eqNode.kind !== 'eq') return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Check if rhs matches the target variable
  if (rhs.kind === 'symbol' && targetVar.kind === 'symbol') {
    const rhsSym = rhs.value as ASymbol;
    const targetSym = targetVar.value as ASymbol;
    if (rhsSym.name === targetSym.name) {
      return lhs;
    }
  }

  return undefined;
}

// solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)
// Linear equation solver: k*x + c = 0  =>  x = -c/k
export function ruleSolveLinear(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [eqNode, goalNode] = args;

  // Check goal is solved_for(?x)
  if (!isFunc(goalNode, 'solved_for')) return undefined;
  const goalArgs = getArgs(goalNode);
  if (goalArgs.length !== 1) return undefined;
  const targetVar = goalArgs[0];
  if (targetVar.kind !== 'symbol') return undefined;
  const targetSym = targetVar.value as ASymbol;

  // Check first arg is eq(sum(mul(?k, ?x), ?c), 0)
  if (eqNode.kind !== 'eq') return undefined;
  const eqArgs = getArgs(eqNode);
  if (eqArgs.length !== 2) return undefined;

  const [lhs, rhs] = eqArgs;

  // Check rhs is 0
  if (!isNumber(rhs) || rhs.value !== 0) return undefined;

  // Check lhs is sum(mul(?k, ?x), ?c)
  if (!isFunc(lhs, 'sum')) return undefined;
  const sumArgs = getArgs(lhs);
  if (sumArgs.length !== 2) return undefined;

  const [term1, term2] = sumArgs;

  // Try both orders: mul(?k, ?x) + ?c or ?c + mul(?k, ?x)
  let k: AstNode | undefined;
  let c: AstNode | undefined;
  let x: AstNode | undefined;

  // Try term1 = mul(?k, ?x), term2 = ?c
  if (isFunc(term1, 'mul')) {
    const mulArgs = getArgs(term1);
    if (mulArgs.length === 2) {
      const [factor1, factor2] = mulArgs;

      // Check if factor1 is number and factor2 matches target var
      if (isNumber(factor1) && factor2.kind === 'symbol') {
        const factor2Sym = factor2.value as ASymbol;
        if (factor2Sym.name === targetSym.name && isNumber(term2)) {
          k = factor1;
          x = factor2;
          c = term2;
        }
      }
      // Or factor2 is number and factor1 matches target var
      if (isNumber(factor2) && factor1.kind === 'symbol') {
        const factor1Sym = factor1.value as ASymbol;
        if (factor1Sym.name === targetSym.name && isNumber(term2)) {
          k = factor2;
          x = factor1;
          c = term2;
        }
      }
    }
  }

  // Try term2 = mul(?k, ?x), term1 = ?c
  if (!k && isFunc(term2, 'mul')) {
    const mulArgs = getArgs(term2);
    if (mulArgs.length === 2) {
      const [factor1, factor2] = mulArgs;

      if (isNumber(factor1) && factor2.kind === 'symbol') {
        const factor2Sym = factor2.value as ASymbol;
        if (factor2Sym.name === targetSym.name && isNumber(term1)) {
          k = factor1;
          x = factor2;
          c = term1;
        }
      }
      if (isNumber(factor2) && factor1.kind === 'symbol') {
        const factor1Sym = factor1.value as ASymbol;
        if (factor1Sym.name === targetSym.name && isNumber(term1)) {
          k = factor2;
          x = factor1;
          c = term1;
        }
      }
    }
  }

  if (!k || !c || !x) return undefined;

  // Check k is nonzero
  const kVal = k.value as number;
  if (kVal === 0) return undefined;

  // Return eval(-c / k) so it can be evaluated to a number
  return AstNode.create('func', 'eval', [
    AstNode.create('func', 'div', [
      AstNode.create('func', 'neg', [c]),
      k
    ])
  ]);
}

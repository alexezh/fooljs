
// =============================================================================
// Solve + eq rules - Equation solving
// =============================================================================

import { AstNode, ASymbol, isFunc, isNumber, MatchFuncRet } from "../ast.js";
import { getArgs } from "./corerules.js";

// solve(eq(?lhs, ?rhs), solved_for(?x)) => solve(eq(sub(?lhs, ?rhs), 0), solved_for(?x))
// Normalize equation to form: something = 0
export function ruleSolveEqNormalize(ast: AstNode): MatchFuncRet | undefined {
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

  return {
    replace: AstNode.create('func', 'solve', [normalized, goalNode]),
    cost: 4 // Creates 4 new nodes: solve, eq, sub, and number 0
  };
}

// solve(eq(?x, ?rhs), solved_for(?x)) => ?rhs
// Base case: variable isolated on left
export function ruleSolveEqIsolatedLeft(ast: AstNode): MatchFuncRet | undefined {
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
      return {
        replace: rhs,
        cost: 0 // No new nodes, just unwrapping
      };
    }
  }

  return undefined;
}


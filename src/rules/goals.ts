import { AstNode, ASymbol, isFunc, MatchFuncRet } from "../ast.js";
import { getArgs } from "./corerules.js";
import { Runtime } from "../runtime.js";
import { RuntimeImpl } from "../runtimeimpl.js";

// Helper: Structural equality check
// Returns true if two AST nodes are structurally identical
function eqAst(a: AstNode, b: AstNode): boolean {
  // Check if they're the same reference
  if (a === b) return true;

  // Check if kinds match
  if (a.kind !== b.kind) return false;

  // Check values
  if (a.value !== b.value) return false;

  // Check children
  if (a.children === undefined && b.children === undefined) return true;
  if (a.children === undefined || b.children === undefined) return false;
  if (a.children.length !== b.children.length) return false;

  for (let i = 0; i < a.children.length; i++) {
    if (!eqAst(a.children[i], b.children[i])) return false;
  }

  return true;
}

// Helper: Check if a goal holds for an expression
function holdsGoal(goal: AstNode, expr: AstNode): boolean {
  // For now, implement simple checks
  // solved_for(?x) holds if expr is the variable ?x or a simple value
  if (isFunc(goal, 'solved_for')) {
    const goalArgs = getArgs(goal);
    if (goalArgs.length === 1) {
      const targetVar = goalArgs[0];

      // Goal holds if expression is a number (solved to a constant)
      if (expr.kind === 'number') return true;

      // Goal holds if expression is the target variable itself
      if (expr.kind === 'symbol' && targetVar.kind === 'symbol') {
        const exprSym = expr.value as ASymbol;
        const targetSym = targetVar.value as ASymbol;
        return exprSym.name === targetSym.name;
      }
    }
  }

  return false;
}

// =============================================================================
// Solve rules - Generic goal-based solver
// =============================================================================

// solve(?e, ?p) => ?e where holds(?p, ?e)
// Base case: goal is already satisfied
export function ruleSolveGoalMet(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [expr, goal] = args;

  // Check if goal holds
  if (holdsGoal(goal, expr)) {
    return {
      replace: expr,
      cost: 0 // No new nodes, just unwrapping
    };
  }

  return undefined;
}




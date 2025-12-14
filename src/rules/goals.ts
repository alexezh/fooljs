import { AstNode, ASymbol, isFunc } from "../ast";
import { getArgs } from "./corerules";

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
export function ruleSolveGoalMet(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [expr, goal] = args;

  // Check if goal holds
  if (holdsGoal(goal, expr)) {
    return expr;
  }

  return undefined;
}
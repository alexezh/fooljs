import { AstNode, ASymbol, isFunc } from "../ast.js";
import { getArgs } from "./corerules.js";
import { Runtime } from "../runtime.js";

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

// =============================================================================
// Step rule - Bridge between solve and eval
// =============================================================================

// step(?e) => ?e1 where eval(?e) => ?e1, not eq_ast(?e, ?e1)
// Try to make one eval step
export function ruleStep(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'step')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const expr = args[0];

  // Wrap in eval and try to apply eval rules
  const evalExpr = AstNode.create('func', 'eval', [expr]);
  const evalResults = Runtime.instance.matchRule(evalExpr);

  // Try each eval result
  for (const result of evalResults) {
    // Skip if structurally identical (avoid infinite loop)
    if (eqAst(expr, result)) continue;

    // Return the first non-identical result
    return result;
  }

  return undefined;
}

// =============================================================================
// Solve driver - Uses step to make progress
// =============================================================================

// solve(?e, ?p) => solve(?e1, ?p) where not holds(?p, ?e), step(?e) => ?e1
// Make one step toward the goal
export function ruleSolveStep(ast: AstNode): AstNode | undefined {
  if (!isFunc(ast, 'solve')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 2) return undefined;

  const [expr, goal] = args;

  // Only apply if goal doesn't already hold
  if (holdsGoal(goal, expr)) return undefined;

  // Try to make a step
  const stepExpr = AstNode.create('func', 'step', [expr]);
  const stepResults = Runtime.instance.matchRule(stepExpr);

  // Try each step result
  for (const result of stepResults) {
    // Return solve with the stepped expression
    return AstNode.create('func', 'solve', [result, goal]);
  }

  return undefined;
}
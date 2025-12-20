// =============================================================================
// State definitions for common equation solving patterns
// =============================================================================
//
// This module defines standard state patterns and transitions for equation solving.
// States represent "shapes" of expressions, and transitions encode solving strategies.

import { Runtime } from "./runtime.js";
import { AstNode } from "./ast.js";
import { degreeInX, containsVariable } from "./degree.js";

/**
 * Guard function for linear_in_x state.
 * Checks if an equation is linear (degree <= 1) in all variables.
 *
 * Strategy:
 * 1. Extract lhs and rhs from eq(lhs, rhs)
 * 2. Collect all variables from both sides
 * 3. Check that degree is at most 1 in each variable on both sides
 * 4. Check that at least one variable appears
 */
function isLinearEquation(expr: AstNode, bindings: Record<string, AstNode>): boolean {
  // Verify this is an equation
  if (expr.kind !== "func" || expr.value !== "eq") {
    return false;
  }

  const children = expr.children ?? [];
  if (children.length !== 2) {
    return false;
  }

  const [lhs, rhs] = children;

  // Collect all variable names from both sides
  const variables = new Set<string>();
  collectVariables(lhs, variables);
  collectVariables(rhs, variables);

  // No variables means this is not a linear equation (just constants)
  if (variables.size === 0) {
    return false;
  }

  // Check degree in each variable on both lhs and rhs - must be at most 1
  for (const varName of variables) {
    const degLhs = degreeInX(lhs, varName);
    const degRhs = degreeInX(rhs, varName);

    if (degLhs === null || degRhs === null || degLhs > 1 || degRhs > 1) {
      // Either non-polynomial or degree > 1 (e.g., quadratic)
      return false;
    }
  }

  // All variables have degree <= 1 on both sides, and at least one variable exists
  return true;
}

/**
 * Collect all variable names from an expression.
 */
function collectVariables(node: AstNode, vars: Set<string>): void {
  function visit(n: AstNode): void {
    if (n.kind === "symbol") {
      const sym = n.value;
      // Type guard for ASymbol
      if (typeof sym === "object" && sym !== null && "name" in sym) {
        // Only collect simple variables (no index)
        if (sym.index == null || sym.index.length === 0) {
          vars.add(sym.name as string);
        }
        // Also recurse into index if present
        for (const idx of sym.index ?? []) {
          visit(idx);
        }
      }
    }

    for (const ch of n.children ?? []) {
      visit(ch);
    }
  }

  visit(node);
}

/**
 * Initialize standard equation-solving states and transitions.
 *
 * This sets up a knowledge base of STRATEGY states - high-level contexts where
 * different solving approaches apply. This is NOT for mechanical simplification
 * (which is handled by local rewrite rules).
 *
 * Strategy states represent:
 * - What kind of problem we have (linear vs quadratic vs factored)
 * - How far along we are in solving (raw → normalized → isolated)
 * - What solving methods are appropriate at this stage
 *
 * Mechanical simplification (flatten sums, combine like terms, etc.) is handled
 * by the rule engine directly, not via Markov states.
 *
 * Transition weights represent "goodness" of each solving step:
 * - High weight (8-10): Standard, reliable techniques
 * - Medium weight (4-7): Alternative approaches
 * - Low weight (1-3): Fallback options
 */
export function initStates(runtime: Runtime): void {
  // ==========================================================================
  // Basic States
  // ==========================================================================

  // Goal state: Variable is isolated on one side
  runtime.addState(
    "isolated",
    "eq(?x, ?rhs)",
    ["?x"]
  );

  // Alternative goal: RHS isolated
  runtime.addState(
    "isolated_rhs",
    "eq(?lhs, ?x)",
    ["?x"]
  );

  // ==========================================================================
  // Linear Equation States (General)
  // ==========================================================================

  // Linear equation: equation where both sides contain only variables to first power
  // and constants. Variables and constants can appear on either side.
  //
  // Examples:
  //   eq(x, 5)              - variable on left, constant on right
  //   eq(3, x)              - constant on left, variable on right
  //   eq(sum(x, 2), 5)      - linear expression = constant
  //   eq(x, sum(y, 3))      - variable = linear expression
  //   eq(sum(2, x), sum(3, y)) - linear expressions on both sides
  //
  // Validation:
  // - Pattern: eq(?lhs, ?rhs) matches all equations
  // - Guard: isLinearEquation() checks degree <= 1 in all variables
  //
  // The guard performs:
  // 1. Tree traversal to verify no powers > 1
  // 2. Verification that only variables to power 1 and constants appear
  // 3. Checks that at least one variable is present

  // General linear equation (any form) with semantic guard
  runtime.addState(
    "linear_in_x",
    "eq(?lhs, ?rhs)",
    [],
    isLinearEquation  // Semantic guard for degree checking
  );

  // ==========================================================================
  // Linear Equation States: ax + c = 0
  // ==========================================================================

  // General linear form: ax + c = 0
  runtime.addState(
    "linear_eq",
    "eq(sum(mul(?a, ?x), ?c), 0)",
    ["?x"]
  );

  // Normalized linear form: x + k = 0 (coefficient normalized to 1)
  runtime.addState(
    "linear_normalized",
    "eq(sum(?x, ?k), 0)",
    ["?x"]
  );

  // Simple form: x = value (after moving constant)
  runtime.addState(
    "linear_solved",
    "eq(?x, ?value)",
    ["?x"]
  );

  // ==========================================================================
  // Factored Form States: (x + r1)(x + r2) = 0
  // ==========================================================================

  // Product equals zero: (expr1)(expr2) = 0
  runtime.addState(
    "product_eq_zero",
    "eq(mul(?factor1, ?factor2), 0)",
    []
  );

  // Factored quadratic: (x + r1)(x + r2) = 0
  runtime.addState(
    "factored_quadratic",
    "eq(mul(sum(?x, ?r1), sum(?x, ?r2)), 0)",
    ["?x"]
  );

  // Single linear factor: (x + r) = 0
  runtime.addState(
    "single_factor",
    "eq(sum(?x, ?r), 0)",
    ["?x"]
  );

  // ==========================================================================
  // Quadratic Equation States
  // ==========================================================================

  // Raw quadratic: ax² + bx + c = 0
  runtime.addState(
    "quadratic_raw",
    "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0)",
    ["?x"]
  );

  // Normalized quadratic: x² + kx + d = 0 (leading coefficient = 1)
  runtime.addState(
    "quadratic_normalized",
    "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)",
    ["?x"]
  );

  // Complete square form: (x + h)² + k = 0
  runtime.addState(
    "quadratic_square_form",
    "eq(sum(pow(sum(?x, ?h), 2), ?k), 0)",
    ["?x"]
  );

  // Perfect square: (x + h)² = k
  runtime.addState(
    "quadratic_perfect_square",
    "eq(pow(sum(?x, ?h), 2), ?k)",
    ["?x"]
  );

  // ==========================================================================
  // General Polynomial States
  // ==========================================================================

  // General equation in zero form: expr = 0
  runtime.addState(
    "zero_form",
    "eq(?expr, 0)",
    []
  );

  // Non-zero equation: lhs = rhs (needs normalization)
  runtime.addState(
    "non_zero_form",
    "eq(?lhs, ?rhs)",
    []
  );

  // ==========================================================================
  // Transitions: Linear Equations
  // ==========================================================================

  // Linear: General form → Normalized form
  // Divide through by coefficient 'a'
  runtime.addTransition(
    "linear_eq",
    "solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)",
    "isolated",
    10.0  // High weight: direct solve
  );

  // Linear: Normalized → Isolated
  // Move constant to RHS
  runtime.addTransition(
    "linear_normalized",
    "eq(sum(?x, ?k), 0) => eq(?x, neg(?k))",
    "isolated",
    10.0  // High weight: final step
  );

  // ==========================================================================
  // Transitions: Factored Forms
  // ==========================================================================

  // Product equals zero → Split into cases
  // (a)(b) = 0 means a = 0 OR b = 0
  runtime.addTransition(
    "product_eq_zero",
    "eq(mul(?a, ?b), 0) => [eq(?a, 0), eq(?b, 0)]",
    "single_factor",
    8.0  // High weight: standard technique
  );

  // Factored quadratic → Product equals zero (recognize the pattern)
  runtime.addTransition(
    "factored_quadratic",
    "eq(mul(sum(?x, ?r1), sum(?x, ?r2)), 0) => eq(mul(?a, ?b), 0)",
    "product_eq_zero",
    9.0  // High weight: recognize factored form
  );

  // Single factor → Isolated
  // (x + r) = 0 → x = -r
  runtime.addTransition(
    "single_factor",
    "eq(sum(?x, ?r), 0) => eq(?x, neg(?r))",
    "isolated",
    10.0  // High weight: final step
  );

  // ==========================================================================
  // Transitions: Quadratic Equations
  // ==========================================================================

  // Raw quadratic → Normalized
  // Divide by leading coefficient
  runtime.addTransition(
    "quadratic_raw",
    "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0) => eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)",
    "quadratic_normalized",
    7.0  // Medium-high weight: standard first step
  );

  // Normalized → Complete square form
  // Standard completing the square technique
  runtime.addTransition(
    "quadratic_normalized",
    "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0) => eq(sum(pow(sum(?x, ?h), 2), ?k), 0)",
    "quadratic_square_form",
    8.0  // High weight: textbook method
  );

  // Complete square → Perfect square
  // Move constant to RHS
  runtime.addTransition(
    "quadratic_square_form",
    "eq(sum(pow(sum(?x, ?h), 2), ?k), 0) => eq(pow(sum(?x, ?h), 2), neg(?k))",
    "quadratic_perfect_square",
    9.0  // High weight: nearly done
  );

  // Perfect square → Isolated
  // Take square root of both sides
  runtime.addTransition(
    "quadratic_perfect_square",
    "eq(pow(sum(?x, ?h), 2), ?k) => eq(?x, ?value)",
    "isolated",
    9.0  // High weight: final step
  );

  // Quadratic: Try factoring (alternative to completing square)
  runtime.addTransition(
    "quadratic_normalized",
    "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0) => eq(mul(sum(?x, ?r1), sum(?x, ?r2)), 0)",
    "factored_quadratic",
    6.0  // Medium weight: only if it factors nicely
  );

  // Quadratic: Direct formula (low weight - prefer other methods)
  runtime.addTransition(
    "quadratic_raw",
    "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0) => eq(?x, ?value)",
    "isolated",
    3.0  // Low weight: direct but not pedagogical
  );

  // ==========================================================================
  // Transitions: General
  // ==========================================================================

  // Non-zero form → Zero form
  // lhs = rhs → lhs - rhs = 0
  runtime.addTransition(
    "non_zero_form",
    "eq(?lhs, ?rhs) => eq(sum(?lhs, neg(?rhs)), 0)",
    "zero_form",
    8.0  // High weight: standard normalization
  );

  // Isolated RHS → Isolated LHS (symmetry)
  runtime.addTransition(
    "isolated_rhs",
    "eq(?lhs, ?x) => eq(?x, ?lhs)",
    "isolated",
    10.0  // High weight: trivial swap
  );
}

/**
 * Get a human-readable description of all defined states.
 * Useful for debugging and understanding what patterns are available.
 */
export function describeStates(runtime: Runtime): string {
  const lines: string[] = [];

  lines.push("=".repeat(70));
  lines.push("EQUATION SOLVING STATES");
  lines.push("=".repeat(70));
  lines.push("");

  lines.push("LINEAR EQUATIONS (GENERAL):");
  lines.push("  linear_in_x        : eq(?lhs, ?rhs) where both sides are linear");
  lines.push("                       (variables to power 1 and constants only)");
  lines.push("                       Variables/constants can be on either side");
  lines.push("                       Uses semantic guard to validate degree <= 1");
  lines.push("                       Correctly rejects non-linear equations");
  lines.push("");

  lines.push("LINEAR EQUATIONS:");
  lines.push("  linear_eq          : ax + c = 0");
  lines.push("  linear_normalized  : x + k = 0");
  lines.push("  linear_solved      : x = value");
  lines.push("");

  lines.push("FACTORED FORMS:");
  lines.push("  product_eq_zero    : (a)(b) = 0");
  lines.push("  factored_quadratic : (x + r1)(x + r2) = 0");
  lines.push("  single_factor      : (x + r) = 0");
  lines.push("");

  lines.push("QUADRATIC EQUATIONS:");
  lines.push("  quadratic_raw            : ax² + bx + c = 0");
  lines.push("  quadratic_normalized     : x² + kx + d = 0");
  lines.push("  quadratic_square_form    : (x + h)² + k = 0");
  lines.push("  quadratic_perfect_square : (x + h)² = k");
  lines.push("");

  lines.push("GOAL STATES:");
  lines.push("  isolated     : x = value");
  lines.push("  isolated_rhs : value = x");
  lines.push("");

  lines.push("GENERAL:");
  lines.push("  zero_form     : expr = 0");
  lines.push("  non_zero_form : lhs = rhs");
  lines.push("");

  lines.push("NOTE: Mechanical simplification (flatten sums, combine like terms,");
  lines.push("      eval wrappers, etc.) is handled by local rewrite rules,");
  lines.push("      NOT by Markov states. This keeps the state space focused");
  lines.push("      on high-level solving strategy.");
  lines.push("");

  lines.push("=".repeat(70));
  lines.push("");

  // Add the actual graph
  lines.push(runtime.printStateGraph());

  return lines.join('\n');
}

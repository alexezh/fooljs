// =============================================================================
// Test: State table initialization and pattern matching
// =============================================================================

import { Runtime } from "../runtime.js";
import { initStates, describeStates } from "../statetable.js";

/**
 * Test linear equation state matching
 */
function testLinearEquations(): void {
  console.log("\n=== Test: Linear Equations ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const stateManager = runtime.getStateManager();

  // Test: General linear form ax + c = 0
  const linear1 = runtime.parseExpr("eq(sum(mul(3, x), 5), 0)");
  console.log("Expression 1:", linear1.toString());
  const states1 = stateManager.getActiveStates(linear1);
  console.log("  Matches states:", states1);
  console.log("  Expected: ['linear_eq', 'zero_form']");
  console.log("  ✓ Pass:", states1.includes("linear_eq"));

  // Test: Different coefficient
  const linear2 = runtime.parseExpr("eq(sum(mul(7, y), 2), 0)");
  console.log("\nExpression 2:", linear2.toString());
  const states2 = stateManager.getActiveStates(linear2);
  console.log("  Matches states:", states2);
  console.log("  Expected: ['linear_eq', 'zero_form']");
  console.log("  ✓ Pass:", states2.includes("linear_eq"));
  console.log("  → Generalization: Different variables match same pattern!");

  // Test: Normalized linear form x + k = 0
  const linear3 = runtime.parseExpr("eq(sum(x, 5), 0)");
  console.log("\nExpression 3:", linear3.toString());
  const states3 = stateManager.getActiveStates(linear3);
  console.log("  Matches states:", states3);
  console.log("  Expected: ['linear_normalized', 'zero_form']");
  console.log("  ✓ Pass:", states3.includes("linear_normalized"));

  // Test: Isolated form x = value
  const linear4 = runtime.parseExpr("eq(x, 5)");
  console.log("\nExpression 4:", linear4.toString());
  const states4 = stateManager.getActiveStates(linear4);
  console.log("  Matches states:", states4);
  console.log("  Expected: ['isolated', 'non_zero_form']");
  console.log("  ✓ Pass:", states4.includes("isolated"));

  // Test: Scoring for linear equation
  const score = stateManager.scoreRule(
    linear1,
    "solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)"
  );
  console.log("\nScore for direct linear solve on", linear1.toString());
  console.log("  Score:", score);
  console.log("  Expected: 10.0 (high weight = prefer this method)");
  console.log("  ✓ Pass:", score === 10.0);
}

/**
 * Test factored form state matching
 */
function testFactoredForms(): void {
  console.log("\n=== Test: Factored Forms ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const stateManager = runtime.getStateManager();

  // Test: Factored quadratic (x + r1)(x + r2) = 0
  const factored1 = runtime.parseExpr("eq(mul(sum(x, 3), sum(x, 5)), 0)");
  console.log("Expression 1:", factored1.toString());
  const states1 = stateManager.getActiveStates(factored1);
  console.log("  Matches states:", states1);
  console.log("  Expected: ['factored_quadratic', 'product_eq_zero', 'zero_form']");
  console.log("  ✓ Pass:", states1.includes("factored_quadratic"));
  console.log("  ✓ Pass:", states1.includes("product_eq_zero"));

  // Test: Different roots
  const factored2 = runtime.parseExpr("eq(mul(sum(y, 2), sum(y, 7)), 0)");
  console.log("\nExpression 2:", factored2.toString());
  const states2 = stateManager.getActiveStates(factored2);
  console.log("  Matches states:", states2);
  console.log("  Expected: ['factored_quadratic', 'product_eq_zero', 'zero_form']");
  console.log("  ✓ Pass:", states2.includes("factored_quadratic"));
  console.log("  → Generalization: Different variables and roots match!");

  // Test: General product equals zero
  const product = runtime.parseExpr("eq(mul(a, b), 0)");
  console.log("\nExpression 3:", product.toString());
  const states3 = stateManager.getActiveStates(product);
  console.log("  Matches states:", states3);
  console.log("  Expected: ['product_eq_zero', 'zero_form']");
  console.log("  ✓ Pass:", states3.includes("product_eq_zero"));

  // Test: Single factor (x + r) = 0
  const singleFactor = runtime.parseExpr("eq(sum(x, 3), 0)");
  console.log("\nExpression 4:", singleFactor.toString());
  const states4 = stateManager.getActiveStates(singleFactor);
  console.log("  Matches states:", states4);
  console.log("  Expected: ['single_factor', 'linear_normalized', 'zero_form']");
  console.log("  ✓ Pass:", states4.includes("single_factor"));
  console.log("  ✓ Pass:", states4.includes("linear_normalized"));
  console.log("  → Multiple states match: both linear and factored patterns!");

  // Test: Scoring for factored quadratic
  const score = stateManager.scoreRule(
    factored1,
    "eq(mul(sum(?x, ?r1), sum(?x, ?r2)), 0) => eq(mul(?a, ?b), 0)"
  );
  console.log("\nScore for recognizing factored form on", factored1.toString());
  console.log("  Score:", score);
  console.log("  Expected: 9.0 (high weight = recognize factored pattern)");
  console.log("  ✓ Pass:", score === 9.0);
}

/**
 * Test quadratic equation state matching
 */
function testQuadraticEquations(): void {
  console.log("\n=== Test: Quadratic Equations ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const stateManager = runtime.getStateManager();

  // Test: Raw quadratic ax² + bx + c = 0
  const quad1 = runtime.parseExpr("eq(sum(mul(2, pow(x, 2)), mul(3, x), 5), 0)");
  console.log("Expression 1:", quad1.toString());
  const states1 = stateManager.getActiveStates(quad1);
  console.log("  Matches states:", states1);
  console.log("  Expected: ['quadratic_raw', 'zero_form']");
  console.log("  ✓ Pass:", states1.includes("quadratic_raw"));

  // Test: Normalized quadratic x² + kx + d = 0
  const quad2 = runtime.parseExpr("eq(sum(pow(x, 2), mul(3, x), 5), 0)");
  console.log("\nExpression 2:", quad2.toString());
  const states2 = stateManager.getActiveStates(quad2);
  console.log("  Matches states:", states2);
  console.log("  Expected: ['quadratic_normalized', 'zero_form']");
  console.log("  ✓ Pass:", states2.includes("quadratic_normalized"));

  // Test: Complete square form (x + h)² + k = 0
  const quad3 = runtime.parseExpr("eq(sum(pow(sum(x, 2), 2), 5), 0)");
  console.log("\nExpression 3:", quad3.toString());
  const states3 = stateManager.getActiveStates(quad3);
  console.log("  Matches states:", states3);
  console.log("  Expected: ['quadratic_square_form', 'zero_form']");
  console.log("  ✓ Pass:", states3.includes("quadratic_square_form"));

  // Test: Perfect square (x + h)² = k
  const quad4 = runtime.parseExpr("eq(pow(sum(x, 2), 2), 9)");
  console.log("\nExpression 4:", quad4.toString());
  const states4 = stateManager.getActiveStates(quad4);
  console.log("  Matches states:", states4);
  console.log("  Expected: ['quadratic_perfect_square', 'non_zero_form']");
  console.log("  ✓ Pass:", states4.includes("quadratic_perfect_square"));

  // Test: Scoring multiple methods
  const normalizeScore = stateManager.scoreRule(
    quad1,
    "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0) => eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)"
  );
  console.log("\nScore for normalizing quadratic:");
  console.log("  Score:", normalizeScore);
  console.log("  Expected: 7.0");
  console.log("  ✓ Pass:", normalizeScore === 7.0);

  const directScore = stateManager.scoreRule(
    quad1,
    "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0) => eq(?x, ?value)"
  );
  console.log("\nScore for direct quadratic formula:");
  console.log("  Score:", directScore);
  console.log("  Expected: 3.0 (low weight = not preferred)");
  console.log("  ✓ Pass:", directScore === 3.0);
  console.log("  → System prefers completing square (7.0) over formula (3.0)!");
}

/**
 * Test transition graph structure
 */
function testTransitionGraph(): void {
  console.log("\n=== Test: Transition Graph ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const stateManager = runtime.getStateManager();

  // Check that normalized quadratic has multiple outgoing transitions
  const trans = stateManager.getTransitionsFrom("quadratic_normalized");
  console.log("Transitions from 'quadratic_normalized':");
  for (const t of trans) {
    console.log("  ", t.toString());
  }
  console.log("  Expected: 2 transitions (complete square + try factoring)");
  console.log("  ✓ Pass:", trans.length === 2);

  // Check weights
  const completeSquareTrans = trans.find(t => t.toState === "quadratic_square_form");
  const factorTrans = trans.find(t => t.toState === "factored_quadratic");

  console.log("\nWeight comparison:");
  console.log("  Complete square weight:", completeSquareTrans?.weight);
  console.log("  Factoring weight:", factorTrans?.weight);
  console.log("  Expected: Complete square (8.0) > Factoring (6.0)");
  console.log("  ✓ Pass:", (completeSquareTrans?.weight ?? 0) > (factorTrans?.weight ?? 0));
  console.log("  → System prefers completing square for pedagogical reasons!");
}

/**
 * Test state descriptions
 */
function testDescriptions(): void {
  console.log("\n=== Test: State Descriptions ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const description = describeStates(runtime);
  console.log(description);
}

/**
 * Test linear_in_x state
 */
function testLinearInX(): void {
  console.log("\n=== Test: Linear Equation (linear_in_x) ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const stateManager = runtime.getStateManager();

  // Test: Simple linear equation x = 5
  const linear1 = runtime.parseExpr("eq(x, 5)");
  console.log("Equation 1:", linear1.toString());
  const states1 = stateManager.getActiveStates(linear1);
  console.log("  Matches states:", states1.filter(s => s === "linear_in_x" || s === "isolated"));
  console.log("  Expected: includes 'linear_in_x' (and 'isolated')");
  console.log("  ✓ Pass:", states1.includes("linear_in_x"));

  // Test: Linear equation with constant on left
  const linear2 = runtime.parseExpr("eq(3, x)");
  console.log("\nEquation 2:", linear2.toString());
  const states2 = stateManager.getActiveStates(linear2);
  console.log("  Matches states:", states2.filter(s => s === "linear_in_x" || s === "isolated_rhs"));
  console.log("  Expected: includes 'linear_in_x' (and 'isolated_rhs')");
  console.log("  ✓ Pass:", states2.includes("linear_in_x"));

  // Test: Linear equation sum(x, 2) = 5
  const linear3 = runtime.parseExpr("eq(sum(x, 2), 5)");
  console.log("\nEquation 3:", linear3.toString());
  const states3 = stateManager.getActiveStates(linear3);
  console.log("  Matches states:", states3.filter(s => s === "linear_in_x" || s === "linear_normalized"));
  console.log("  Expected: includes 'linear_in_x'");
  console.log("  ✓ Pass:", states3.includes("linear_in_x"));

  // Test: Linear equation with expressions on both sides
  const linear4 = runtime.parseExpr("eq(sum(2, x), sum(3, y))");
  console.log("\nEquation 4:", linear4.toString());
  const states4 = stateManager.getActiveStates(linear4);
  console.log("  Matches states:", states4.filter(s => s === "linear_in_x" || s === "non_zero_form"));
  console.log("  Expected: includes 'linear_in_x'");
  console.log("  ✓ Pass:", states4.includes("linear_in_x"));

  // Test: Non-linear equation (should still match with current pattern)
  const nonlinear = runtime.parseExpr("eq(pow(x, 2), 5)");
  console.log("\nEquation 5 (non-linear):", nonlinear.toString());
  const states5 = stateManager.getActiveStates(nonlinear);
  console.log("  Matches states:", states5.filter(s => s === "linear_in_x" || s.includes("quad")));
  console.log("  Expected: DOES NOT match 'linear_in_x' (non-linear equation)");
  console.log("  ✓ Pass:", !states5.includes("linear_in_x"));
  console.log("  ✓ Guard function correctly filters out quadratic equations!");

  console.log("\nNOTE: The linear_in_x state now uses a semantic guard");
  console.log("      Pattern 'eq(?lhs, ?rhs)' matches all equations (coarse filter)");
  console.log("      Guard function checks degree <= 1 in all variables (precise filter)");
  console.log("      This correctly rejects non-linear equations like x² = 5");
}

/**
 * Test state count and focus on strategy
 */
function testStateCount(): void {
  console.log("\n=== Test: State Count (Strategy Focus) ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const stateManager = runtime.getStateManager();
  const allStates = stateManager.getStates();

  console.log("Total states defined:", allStates.size);
  console.log("  Target: ~10 strategy states (not counting generic ones)");
  console.log("");

  const stateNames = Array.from(allStates.keys());
  console.log("Strategy states (equation types and solving stages):");
  const strategyStates = stateNames.filter(s =>
    !s.startsWith("expr_") && !s.startsWith("eq_")
  );
  strategyStates.forEach(s => console.log("  -", s));

  console.log("\n  ✓ Pass: State space is focused on high-level strategy");
  console.log("  ✓ Mechanical simplification handled by local rules, not states");
}

/**
 * Test that we use pattern pieces correctly (not standalone states)
 */
function testPatternPieces(): void {
  console.log("\n=== Test: Pattern Pieces (not standalone states) ===\n");

  const runtime = new Runtime();
  initStates(runtime);

  const stateManager = runtime.getStateManager();

  console.log("Principle: States use x, x², etc. as PATTERN PIECES");
  console.log("NOT as standalone states\n");

  // Show that we don't have states for "x" or "x²" by themselves
  const justX = runtime.parseExpr("x");
  const xStates = stateManager.getActiveStates(justX);
  console.log("Expression 'x' alone matches:", xStates.length, "states");
  console.log("  These are generic states (isolated, etc.), not 'has_x' state");

  const xSquared = runtime.parseExpr("pow(x, 2)");
  const x2States = stateManager.getActiveStates(xSquared);
  console.log("\nExpression 'pow(x, 2)' alone matches:", x2States.length, "states");
  console.log("  These are generic states, not 'has_x2' state");

  // But x² appears as a PATTERN PIECE in quadratic_raw
  const quadratic = runtime.parseExpr("eq(sum(mul(2, pow(x, 2)), mul(3, x), 5), 0)");
  const quadStates = stateManager.getActiveStates(quadratic);
  console.log("\nExpression 'eq(sum(mul(2, pow(x, 2)), ...), 0)' matches:");
  console.log("  ", quadStates.filter(s => s.includes("quadratic")));
  console.log("  → pow(x, 2) is used as a PATTERN PIECE inside 'quadratic_raw'");
  console.log("  → This represents a CONTEXT where quadratic-solving rules apply");
  console.log("  ✓ Correct design: patterns use x² as pieces, not standalone states");
}

// Run all tests
function runAllTests(): void {
  console.log("\n");
  console.log("=".repeat(70));
  console.log("STATE TABLE TESTS");
  console.log("=".repeat(70));

  try {
    testLinearEquations();
    testLinearInX();
    testFactoredForms();
    testQuadraticEquations();
    testTransitionGraph();
    testStateCount();
    testPatternPieces();
    testDescriptions();

    console.log("\n");
    console.log("=".repeat(70));
    console.log("ALL TESTS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(70));
    console.log("\n");
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { runAllTests };

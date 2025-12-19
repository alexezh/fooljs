// =============================================================================
// Test: State-based rule guidance
// =============================================================================

import { Runtime } from "../runtime.js";
import { initRules } from "../ruletable.js";
import { AstNode } from "../ast.js";

/**
 * Test basic state pattern matching
 */
function testStateMatching(): void {
  console.log("\n=== Test: State Pattern Matching ===\n");

  const runtime = Runtime.instance;
  const stateManager = runtime.getStateManager();

  // Define a simple state pattern
  runtime.addState("simple_sum", "sum(?a, ?b)");
  // Note: Constraint checking in patterns not yet implemented
  // runtime.addState("sum_with_number", "sum(?x, ?n) where ?n is number");

  // Test expressions
  const expr1 = runtime.parseExpr("sum(x, y)");
  const expr2 = runtime.parseExpr("sum(x, 5)");
  const expr3 = runtime.parseExpr("mul(x, y)");

  console.log("Expression 1:", expr1.toString());
  const states1 = stateManager.getActiveStates(expr1);
  console.log("  Matches states:", states1);
  console.log("  Expected: ['simple_sum']");
  console.log("  ✓ Pass:", states1.length === 1 && states1[0] === "simple_sum");

  console.log("\nExpression 2:", expr2.toString());
  const states2 = stateManager.getActiveStates(expr2);
  console.log("  Matches states:", states2);
  console.log("  Expected: ['simple_sum']");
  console.log("  ✓ Pass:", states2.includes("simple_sum"));

  console.log("\nExpression 3:", expr3.toString());
  const states3 = stateManager.getActiveStates(expr3);
  console.log("  Matches states:", states3);
  console.log("  Expected: []");
  console.log("  ✓ Pass:", states3.length === 0);
}

/**
 * Test state transitions and scoring
 */
function testTransitionsAndScoring(): void {
  console.log("\n=== Test: Transitions and Scoring ===\n");

  const runtime = new Runtime(); // Use a fresh runtime
  const stateManager = runtime.getStateManager();

  // Define states
  runtime.addState("start_state", "sum(?a, ?b)");
  runtime.addState("mid_state", "mul(?a, ?b)");
  runtime.addState("end_state", "pow(?a, ?b)");

  // Define transitions
  runtime.addTransition("start_state", "rule_alpha", "mid_state", 5.0);
  runtime.addTransition("start_state", "rule_beta", "end_state", 2.0);
  runtime.addTransition("mid_state", "rule_gamma", "end_state", 10.0);

  // Test scoring
  const expr = runtime.parseExpr("sum(x, y)");

  const score1 = stateManager.scoreRule(expr, "rule_alpha");
  console.log("Score for rule_alpha on sum(x,y):", score1);
  console.log("  Expected: 5.0");
  console.log("  ✓ Pass:", score1 === 5.0);

  const score2 = stateManager.scoreRule(expr, "rule_beta");
  console.log("\nScore for rule_beta on sum(x,y):", score2);
  console.log("  Expected: 2.0");
  console.log("  ✓ Pass:", score2 === 2.0);

  const score3 = stateManager.scoreRule(expr, "rule_gamma");
  console.log("\nScore for rule_gamma on sum(x,y):", score3);
  console.log("  Expected: 0.0 (no transition from start_state)");
  console.log("  ✓ Pass:", score3 === 0.0);

  // Print the graph
  console.log("\n" + runtime.printStateGraph());
}

/**
 * Test weight updates (learning)
 */
function testWeightUpdates(): void {
  console.log("\n=== Test: Weight Updates (Learning) ===\n");

  const runtime = new Runtime();
  const stateManager = runtime.getStateManager();

  // Setup
  runtime.addState("state_a", "sum(?x, ?y)");
  runtime.addState("state_b", "mul(?x, ?y)");
  runtime.addTransition("state_a", "rule_x", "state_b", 1.0);

  const expr = runtime.parseExpr("sum(a, b)");

  // Initial score
  const initialScore = stateManager.scoreRule(expr, "rule_x");
  console.log("Initial score:", initialScore);
  console.log("  Expected: 1.0");

  // Update weight
  runtime.updateTransitionWeight("state_a", "rule_x", +2.5);

  // New score
  const newScore = stateManager.scoreRule(expr, "rule_x");
  console.log("\nAfter +2.5 update, score:", newScore);
  console.log("  Expected: 3.5");
  console.log("  ✓ Pass:", newScore === 3.5);

  // Another update
  runtime.updateTransitionWeight("state_a", "rule_x", -1.0);

  const finalScore = stateManager.scoreRule(expr, "rule_x");
  console.log("\nAfter -1.0 update, score:", finalScore);
  console.log("  Expected: 2.5");
  console.log("  ✓ Pass:", finalScore === 2.5);
}

/**
 * Test complex pattern matching with nested expressions
 */
function testNestedPatterns(): void {
  console.log("\n=== Test: Nested Pattern Matching ===\n");

  const runtime = new Runtime();
  const stateManager = runtime.getStateManager();

  // Define quadratic pattern
  runtime.addState(
    "quadratic",
    "eq(sum(pow(?x, 2), mul(?k, ?x), ?c), 0)",
    ["?x"]
  );

  // Test expression
  const expr = runtime.parseExpr("eq(sum(pow(x, 2), mul(3, x), 5), 0)");

  console.log("Expression:", expr.toString());
  const states = stateManager.getActiveStates(expr);
  console.log("Matches states:", states);
  console.log("  Expected: ['quadratic']");
  console.log("  ✓ Pass:", states.length === 1 && states[0] === "quadratic");

  // Test a similar but different expression
  const expr2 = runtime.parseExpr("eq(sum(pow(y, 2), mul(7, y), 2), 0)");

  console.log("\nExpression 2:", expr2.toString());
  const states2 = stateManager.getActiveStates(expr2);
  console.log("Matches states:", states2);
  console.log("  Expected: ['quadratic']");
  console.log("  ✓ Pass:", states2.length === 1 && states2[0] === "quadratic");
  console.log("  → Generalization works! Different variables match same pattern.");
}

/**
 * Test multiple matching states (overlapping patterns)
 */
function testOverlappingStates(): void {
  console.log("\n=== Test: Overlapping State Patterns ===\n");

  const runtime = new Runtime();
  const stateManager = runtime.getStateManager();

  // Define overlapping patterns
  runtime.addState("any_sum", "sum(?a, ?b)");
  runtime.addState("sum_of_three", "sum(?a, ?b, ?c)");
  runtime.addState("polynomial", "sum(?terms...)");
  runtime.addState("normalized", "sum(?x)"); // Target state

  // Add transitions with different weights
  runtime.addTransition("any_sum", "rule_normalize", "normalized", 1.0);
  runtime.addTransition("sum_of_three", "rule_normalize", "normalized", 3.0);
  runtime.addTransition("polynomial", "rule_normalize", "normalized", 0.5);

  // Test expression that matches multiple patterns
  const expr = runtime.parseExpr("sum(a, b, c)");

  console.log("Expression:", expr.toString());
  const states = stateManager.getActiveStates(expr);
  console.log("Matches states:", states.sort());

  // Score should be sum of all matching state transitions
  const score = stateManager.scoreRule(expr, "rule_normalize");
  console.log("\nScore for rule_normalize:", score);
  console.log("  Expected: 4.5 (sum of 1.0 + 3.0 + 0.5)");
  console.log("  (or subset if not all patterns match)");
  console.log("  → Multiple states can influence the same rule!");
}

// Run all tests
function runAllTests(): void {
  console.log("\n");
  console.log("=".repeat(70));
  console.log("STATE SYSTEM TESTS");
  console.log("=".repeat(70));

  try {
    testStateMatching();
    testTransitionsAndScoring();
    testWeightUpdates();
    testNestedPatterns();
    testOverlappingStates();

    console.log("\n");
    console.log("=".repeat(70));
    console.log("ALL TESTS COMPLETED");
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

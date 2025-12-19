// =============================================================================
// Example: Using state-based rule guidance for quadratic equations
// =============================================================================
//
// This example demonstrates how to use the recursive Markov graph state system
// to guide the solver through quadratic equation solving.
//
// The key idea:
// - States are patterns (not concrete expressions)
// - Transitions have weights that guide rule selection
// - The same state graph is applied recursively at every subtree
//
// This enables:
// - Generalization across unseen expressions matching the same pattern
// - Learning from solve traces to improve weights
// - Human-like abstraction: "any ax²+bx+c behaves similarly"

import { Runtime } from "../src/runtime.js";
import { initCore } from "../src/ruletable.js";

// Initialize the runtime with core rules
const runtime = Runtime.instance;
initCore(runtime);

// =============================================================================
// Define state patterns for quadratic equation solving
// =============================================================================

// State: Raw quadratic equation ax²+bx+c = 0
runtime.addState(
  "quad_raw",
  "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0)",
  ["?x"]
);

// State: Quadratic with leading coefficient 1: x²+kx+d = 0
runtime.addState(
  "quad_leading1",
  "eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)",
  ["?x"]
);

// State: Complete square form: (x+h)²+k = 0
runtime.addState(
  "square_form",
  "eq(sum(pow(sum(?x, ?h), 2), ?k), 0)",
  ["?x"]
);

// State: Isolated variable: x = rhs
runtime.addState(
  "isolated",
  "eq(?x, ?rhs)",
  ["?x"]
);

// =============================================================================
// Define transitions with weights
// =============================================================================
// Higher weights = more preferred transitions
// These weights would typically be learned from data, but we can initialize
// them based on human knowledge of good solving strategies.

// quad_raw -> quad_leading1
// Normalize leading coefficient to 1 (divide through by a)
// This is a common first step in solving quadratics
runtime.addTransition(
  "quad_raw",
  "solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)", // This is a placeholder
  "quad_leading1",
  10.0  // High weight = strongly prefer this step
);

// quad_leading1 -> square_form
// Complete the square to transform into (x+h)²+k form
// This is the standard "textbook" method
runtime.addTransition(
  "quad_leading1",
  "solve(eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0), solved_for(?x)) => div(neg(?c), ?k)", // Placeholder
  "square_form",
  8.0  // High weight for standard solving method
);

// square_form -> isolated
// Take square root and isolate variable
runtime.addTransition(
  "square_form",
  "solve(eq(sum(pow(sum(?x, ?h), 2), ?k), 0), solved_for(?x)) => div(neg(?c), ?k)", // Placeholder
  "isolated",
  10.0  // High weight = we're almost done!
);

// =============================================================================
// Alternative lower-weight transitions (for exploration)
// =============================================================================

// Direct application of quadratic formula (less preferred than completing square)
runtime.addTransition(
  "quad_raw",
  "solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)", // Placeholder
  "isolated",
  3.0  // Lower weight = only use if other paths fail
);

// =============================================================================
// Print the state graph
// =============================================================================

console.log(runtime.printStateGraph());
console.log("\n");

// =============================================================================
// How this affects search:
// =============================================================================
//
// When the A* search encounters a sub-expression like:
//   eq(sum(pow(x, 2), mul(3, x), 5), 0)
//
// 1. It matches against state patterns and finds: "quad_leading1"
//
// 2. For each matching rule, it looks up the transition weight:
//    - ruleCompleteSquare: weight = 8.0 from quad_leading1
//    - Other rules: no weight (default 0)
//
// 3. The search adjusts costs: higher weights = lower cost (preferred)
//    - Cost adjustment = -stateScore
//    - So ruleCompleteSquare gets: cost - 8.0
//
// 4. The A* heap prioritizes states with lower total cost
//    → Rules with higher state weights are explored first
//
// 5. This happens recursively at every subtree, so even nested quadratics
//    inside larger expressions benefit from the same guidance.
//
// =============================================================================
// Learning from traces:
// =============================================================================
//
// After observing successful solve paths, you can update weights:
//
//   runtime.updateTransitionWeight("quad_leading1", "ruleCompleteSquare", +1.0);
//
// Or decrease weights for paths that led to dead ends:
//
//   runtime.updateTransitionWeight("quad_raw", "ruleBadChoice", -2.0);
//
// Over time, the weights converge to represent successful solving strategies.
//
// =============================================================================

// Example: Query which states match a given expression
const exampleExpr = runtime.parseExpr("eq(sum(pow(x, 2), mul(3, x), 5), 0)");
const stateManager = runtime.getStateManager();
const matchingStates = stateManager.getActiveStates(exampleExpr);

console.log("Example expression:", exampleExpr.toString());
console.log("Matching states:", matchingStates);
console.log("\n");

// Example: Score a rule for this expression
// (Note: The rule names here are placeholders - in reality they'd be the actual rule definitions)
const exampleRule = "solve(eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0), solved_for(?x)) => div(neg(?c), ?k)";
const score = stateManager.scoreRule(exampleExpr, exampleRule);
console.log("Score for example rule:", score);
console.log("(Higher score = more preferred transition)");

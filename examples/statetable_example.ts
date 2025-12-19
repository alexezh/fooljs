// =============================================================================
// Example: Using initStates() for equation solving guidance
// =============================================================================

import { Runtime } from "../src/runtime.js";
import { initStates, describeStates } from "../src/statetable.js";

console.log("\n" + "=".repeat(70));
console.log("EXAMPLE: State-Based Equation Solving Guidance");
console.log("=".repeat(70) + "\n");

// Initialize runtime with standard equation-solving states
const runtime = new Runtime();
initStates(runtime);

const stateManager = runtime.getStateManager();

// =============================================================================
// Example 1: Linear Equation ax + c = 0
// =============================================================================

console.log("Example 1: Linear Equation");
console.log("-".repeat(70));

const linear = runtime.parseExpr("eq(sum(mul(3, x), 5), 0)");
console.log("Equation:", linear.toString());
console.log("  → 3x + 5 = 0\n");

const linearStates = stateManager.getActiveStates(linear);
console.log("Active states:", linearStates.join(", "));

// The linear_eq state has a high-weight transition to "isolated"
const linearScore = stateManager.scoreRule(
  linear,
  "solve(eq(sum(mul(?k, ?x), ?c), 0), solved_for(?x)) => div(neg(?c), ?k)"
);

console.log("\nRule scores:");
console.log("  Direct solve: score =", linearScore);
console.log("  → High score (10.0) means this rule is strongly preferred");
console.log("  → Search will prioritize this transformation\n");

// =============================================================================
// Example 2: Factored Form (x + r1)(x + r2) = 0
// =============================================================================

console.log("\nExample 2: Factored Quadratic");
console.log("-".repeat(70));

const factored = runtime.parseExpr("eq(mul(sum(x, 3), sum(x, 5)), 0)");
console.log("Equation:", factored.toString());
console.log("  → (x + 3)(x + 5) = 0\n");

const factoredStates = stateManager.getActiveStates(factored);
console.log("Active states:", factoredStates.join(", "));

// Check the transition weights
const recognizeFactored = stateManager.scoreRule(
  factored,
  "eq(mul(sum(?x, ?r1), sum(?x, ?r2)), 0) => eq(mul(?a, ?b), 0)"
);

console.log("\nRule scores:");
console.log("  Recognize factored form: score =", recognizeFactored);
console.log("  → This guides the solver to apply zero-product property");
console.log("  → (x + 3)(x + 5) = 0  ⟹  (x + 3) = 0  OR  (x + 5) = 0\n");

// =============================================================================
// Example 3: Quadratic Equation - Multiple Solving Paths
// =============================================================================

console.log("\nExample 3: Quadratic with Multiple Solving Strategies");
console.log("-".repeat(70));

const quadratic = runtime.parseExpr("eq(sum(mul(2, pow(x, 2)), mul(3, x), 5), 0)");
console.log("Equation:", quadratic.toString());
console.log("  → 2x² + 3x + 5 = 0\n");

const quadStates = stateManager.getActiveStates(quadratic);
console.log("Active states:", quadStates.join(", "));

// Compare different solving strategies
const normalizeScore = stateManager.scoreRule(
  quadratic,
  "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0) => eq(sum(pow(?x, 2), mul(?k, ?x), ?d), 0)"
);

const directFormulaScore = stateManager.scoreRule(
  quadratic,
  "eq(sum(mul(?a, pow(?x, 2)), mul(?b, ?x), ?c), 0) => eq(?x, ?value)"
);

console.log("\nRule scores:");
console.log("  Normalize to x² + kx + d = 0: score =", normalizeScore);
console.log("  Direct quadratic formula:     score =", directFormulaScore);
console.log("\n  → System prefers normalization (7.0) over direct formula (3.0)");
console.log("  → This guides toward pedagogically better solving path:");
console.log("     1. Normalize leading coefficient");
console.log("     2. Complete the square");
console.log("     3. Take square root\n");

// =============================================================================
// Example 4: Generalization Across Different Variables
// =============================================================================

console.log("\nExample 4: Generalization");
console.log("-".repeat(70));

const linear_x = runtime.parseExpr("eq(sum(mul(3, x), 5), 0)");
const linear_y = runtime.parseExpr("eq(sum(mul(7, y), 2), 0)");
const linear_z = runtime.parseExpr("eq(sum(mul(2, z), 9), 0)");

console.log("These equations all match the same 'linear_eq' pattern:");
console.log("  1.", linear_x.toString(), " → 3x + 5 = 0");
console.log("  2.", linear_y.toString(), " → 7y + 2 = 0");
console.log("  3.", linear_z.toString(), " → 2z + 9 = 0\n");

console.log("States matched:");
const matchesX = stateManager.getActiveStates(linear_x).includes("linear_eq");
const matchesY = stateManager.getActiveStates(linear_y).includes("linear_eq");
const matchesZ = stateManager.getActiveStates(linear_z).includes("linear_eq");

console.log("  ✓", linear_x.toString(), "→ linear_eq:", matchesX);
console.log("  ✓", linear_y.toString(), "→ linear_eq:", matchesY);
console.log("  ✓", linear_z.toString(), "→ linear_eq:", matchesZ);
console.log("\n  → Same solving strategy applies to all!");
console.log("  → Learn once, generalize everywhere\n");

// =============================================================================
// Show the complete state graph
// =============================================================================

console.log("\nComplete State Graph:");
console.log("=".repeat(70));
console.log(describeStates(runtime));

// =============================================================================
// Learning Example
// =============================================================================

console.log("\n\nLearning Example:");
console.log("-".repeat(70));
console.log("After observing successful solve traces, update weights:\n");

console.log("// Successful path observed:");
console.log("// quadratic_raw → normalize → complete_square → isolated");
console.log("runtime.updateTransitionWeight('quadratic_raw', 'normalize_rule', +0.5);\n");

console.log("// Failed path observed:");
console.log("// quadratic_raw → direct_formula → got stuck");
console.log("runtime.updateTransitionWeight('quadratic_raw', 'direct_formula_rule', -0.2);\n");

console.log("Over time, weights converge to optimal solving strategies!");
console.log("=".repeat(70) + "\n");

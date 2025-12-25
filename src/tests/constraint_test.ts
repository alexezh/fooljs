import { parse } from "../parser.js";
import { SkillExecutor } from "../skillexecutor.js";
import { RuntimeImpl } from "../runtimeimpl.js";
import { seedBaselineSkills } from "../baselineskills.js";
import { SkillRegistry } from "../skillregistry.js";

console.log("=== Testing Complex Constraint Support ===\n");

const runtime = new RuntimeImpl();
const executor = new SkillExecutor(runtime);
const registry = new SkillRegistry();

// Seed the baseline skills (including the newly enabled factor_out_x skill)
await seedBaselineSkills(registry);

console.log("Baseline skills loaded\n");

// Test 1: Factor out x from sum of x-multiples
try {
  console.log("Test 1: Factor out x from sum(2x, 3x) = 10");
  const skill = registry.get("factor_out_x_from_sum_inline" as any);
  if (!skill) throw new Error("Skill not found");

  // Test case: solve(eq(sum(mul(2, x), mul(3, x)), 10), solved_for(x))
  // Expected result: solve(eq(mul(x, sum(2, 3)), 10), solved_for(x))
  const input = parse("solve(eq(sum(mul(2, x), mul(3, x)), 10), solved_for(x))");
  console.log("Input:", input.toString());
  console.log("Expected: solve(eq(mul(x, sum(2, 3)), 10), solved_for(x))");

  const result = executor.tryExecute(skill, input, [], { kind: 'solve_for', x: 'x' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString().includes("mul(x")) {
    console.log("✓ Test 1 passed\n");
  } else {
    console.log("✗ Test 1 failed\n");
  }
} catch (e) {
  console.log("✗ Test 1 failed with error:", e);
  console.log();
}

// Test 2: Factor out x from sum with just x
try {
  console.log("Test 2: Factor out x from sum(x, mul(2, x)) = 9");
  const skill = registry.get("factor_out_x_from_sum_inline" as any);
  if (!skill) throw new Error("Skill not found");

  // Test case: solve(eq(sum(x, mul(2, x)), 9), solved_for(x))
  // Expected result: solve(eq(mul(x, sum(1, 2)), 9), solved_for(x))
  const input = parse("solve(eq(sum(x, mul(2, x)), 9), solved_for(x))");
  console.log("Input:", input.toString());
  console.log("Expected: solve(eq(mul(x, sum(1, 2)), 9), solved_for(x))");

  const result = executor.tryExecute(skill, input, [], { kind: 'solve_for', x: 'x' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString().includes("mul(x")) {
    console.log("✓ Test 2 passed\n");
  } else {
    console.log("✗ Test 2 failed\n");
  }
} catch (e) {
  console.log("✗ Test 2 failed with error:", e);
  console.log();
}

// Test 3: Should NOT factor out x from sum without x
try {
  console.log("Test 3: Should NOT factor out x from sum(2, 3) = 5");
  const skill = registry.get("factor_out_x_from_sum_inline" as any);
  if (!skill) throw new Error("Skill not found");

  // Test case: solve(eq(sum(2, 3), 5), solved_for(x))
  // Expected result: NOT applied (no x in the sum)
  const input = parse("solve(eq(sum(2, 3), 5), solved_for(x))");
  console.log("Input:", input.toString());
  console.log("Expected: NOT applied");

  const result = executor.tryExecute(skill, input, [], { kind: 'solve_for', x: 'x' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (!result.applied) {
    console.log("✓ Test 3 passed\n");
  } else {
    console.log("✗ Test 3 failed (should not have applied)\n");
  }
} catch (e) {
  console.log("✗ Test 3 failed with error:", e);
  console.log();
}

// Test 4: Factor out x with different ordering mul(x, 5) instead of mul(5, x)
try {
  console.log("Test 4: Factor out x from sum(mul(x, 2), mul(x, 3)) = 15");
  const skill = registry.get("factor_out_x_from_sum_inline" as any);
  if (!skill) throw new Error("Skill not found");

  // Test case: solve(eq(sum(mul(x, 2), mul(x, 3)), 15), solved_for(x))
  // Expected result: solve(eq(mul(x, sum(2, 3)), 15), solved_for(x))
  const input = parse("solve(eq(sum(mul(x, 2), mul(x, 3)), 15), solved_for(x))");
  console.log("Input:", input.toString());
  console.log("Expected: solve(eq(mul(x, sum(2, 3)), 15), solved_for(x))");

  const result = executor.tryExecute(skill, input, [], { kind: 'solve_for', x: 'x' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString().includes("mul(x")) {
    console.log("✓ Test 4 passed\n");
  } else {
    console.log("✗ Test 4 failed\n");
  }
} catch (e) {
  console.log("✗ Test 4 failed with error:", e);
  console.log();
}

console.log("=== All constraint tests completed ===");

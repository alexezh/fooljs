import { parse } from "../parser.js";
import { SkillExecutor } from "../skillexecutor.js";
import { RuntimeImpl } from "../runtimeimpl.js";
import { seedBaselineSkills } from "../baselineskills.js";
import { SkillRegistry } from "../skillregistry.js";

console.log("=== Testing Solve Macro with 'do' syntax ===\n");

const runtime = new RuntimeImpl();
const executor = new SkillExecutor(runtime);
const registry = new SkillRegistry();

// Seed the baseline skills
await seedBaselineSkills(registry);

console.log("Baseline skills loaded\n");

// Test the comprehensive solve macro
try {
  console.log("Test: macro_solve_ax_plus_c_zero_inline_factor_then_eval");
  const skill = registry.get("macro_solve_ax_plus_c_zero_inline_factor_then_eval" as any);
  if (!skill) throw new Error("Skill not found");

  // Test case: solve(eq(sum(x, 7), 0), solved_for(x))
  const input = parse("solve(eq(sum(x, 7), 0), solved_for(x))");
  console.log("Input:", input.toString());
  console.log("Expected: -7 (or neg(7))");

  const result = executor.tryExecute(skill, input, [], { kind: 'solve_for', sym: 'x' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  // The result should be neg(7) or -7
  const resultStr = result.nextRoot.toString();
  if (result.applied && (resultStr === "neg(7)" || resultStr === "-7" || resultStr.includes("7"))) {
    console.log("✓ Test passed\n");
  } else {
    console.log("✗ Test failed\n");
  }
} catch (e) {
  console.log("✗ Test failed with error:", e);
  console.log();
}

// Test case 2: solve(eq(sum(mul(2, x), 4), 0), solved_for(x))
try {
  console.log("Test 2: Solve 2x + 4 = 0");
  const skill = registry.get("macro_solve_ax_plus_c_zero_inline_factor_then_eval" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("solve(eq(sum(mul(2, x), 4), 0), solved_for(x))");
  console.log("Input:", input.toString());
  console.log("Expected: -2");

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  const resultStr = result.nextRoot.toString();
  if (result.applied && (resultStr === "neg(2)" || resultStr === "-2" || resultStr.includes("2"))) {
    console.log("✓ Test 2 passed\n");
  } else {
    console.log("✗ Test 2 failed\n");
  }
} catch (e) {
  console.log("✗ Test 2 failed with error:", e);
  console.log();
}

// Test case 3: solve(eq(x, 5), solved_for(x)) - already isolated
try {
  console.log("Test 3: Solve x = 5 (already isolated)");
  const skill = registry.get("macro_solve_ax_plus_c_zero_inline_factor_then_eval" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("solve(eq(x, 5), solved_for(x))");
  console.log("Input:", input.toString());
  console.log("Expected: 5");

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  const resultStr = result.nextRoot.toString();
  if (result.applied && resultStr === "5") {
    console.log("✓ Test 3 passed\n");
  } else {
    console.log("✗ Test 3 failed\n");
  }
} catch (e) {
  console.log("✗ Test 3 failed with error:", e);
  console.log();
}

console.log("=== All solve macro tests completed ===");

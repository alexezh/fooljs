import { parse } from "../parser.js";
import { SkillExecutor } from "../skillexecutor.js";
import { RuntimeImpl } from "../runtimeimpl.js";
import { seedBaselineSkills } from "../baselineskills.js";
import { SkillRegistry } from "../skillregistry.js";

console.log("=== Testing Baseline Skills with 'do' syntax ===\n");

const runtime = new RuntimeImpl();
const executor = new SkillExecutor(runtime);
const registry = new SkillRegistry();

// Seed the baseline skills
await seedBaselineSkills(registry);

console.log("Baseline skills loaded\n");

// Test 1: eq_zero_form_inline
try {
  console.log("Test 1: eq_zero_form_inline");
  const skill = registry.get("eq_zero_form_inline" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("eq(x, 5)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString().includes("sum(x,neg(5))")) {
    console.log("✓ Test 1 passed\n");
  } else {
    console.log("✗ Test 1 failed\n");
  }
} catch (e) {
  console.log("✗ Test 1 failed with error:", e);
  console.log();
}

// Test 2: local_simplify_bounded_inline
try {
  console.log("Test 2: local_simplify_bounded_inline - paren removal");
  const skill = registry.get("local_simplify_bounded_inline" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("paren(5)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString() === "5") {
    console.log("✓ Test 2 passed\n");
  } else {
    console.log("✗ Test 2 failed\n");
  }
} catch (e) {
  console.log("✗ Test 2 failed with error:", e);
  console.log();
}

// Test 3: eq_symmetry_inline
try {
  console.log("Test 3: eq_symmetry_inline");
  const skill = registry.get("eq_symmetry_inline" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("eq(x, 5)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString() === "eq(5,x)") {
    console.log("✓ Test 3 passed\n");
  } else {
    console.log("✗ Test 3 failed\n");
  }
} catch (e) {
  console.log("✗ Test 3 failed with error:", e);
  console.log();
}

// Test 4: sub_to_sum_inline
try {
  console.log("Test 4: sub_to_sum_inline");
  const skill = registry.get("sub_to_sum_inline" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("sub(x, 5)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString() === "sum(x,neg(5))") {
    console.log("✓ Test 4 passed\n");
  } else {
    console.log("✗ Test 4 failed\n");
  }
} catch (e) {
  console.log("✗ Test 4 failed with error:", e);
  console.log();
}

// Test 5: solve_discharge_isolated_inline
try {
  console.log("Test 5: solve_discharge_isolated_inline");
  const skill = registry.get("solve_discharge_isolated_inline" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("solve(eq(x, 5), solved_for(x))");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString() === "5") {
    console.log("✓ Test 5 passed\n");
  } else {
    console.log("✗ Test 5 failed\n");
  }
} catch (e) {
  console.log("✗ Test 5 failed with error:", e);
  console.log();
}

// Test 6: eq_move_addend_from_zero_inline
try {
  console.log("Test 6: eq_move_addend_from_zero_inline");
  const skill = registry.get("eq_move_addend_from_zero_inline" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("eq(sum(x, 5), 0)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied && result.nextRoot.toString() === "eq(x,neg(5))") {
    console.log("✓ Test 6 passed\n");
  } else {
    console.log("✗ Test 6 failed\n");
  }
} catch (e) {
  console.log("✗ Test 6 failed with error:", e);
  console.log();
}

console.log("=== All baseline skill tests completed ===");

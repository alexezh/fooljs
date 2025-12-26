import { parse } from "../parser.js";
import { SkillExecutor } from "../skillexecutor.js";
import { RuntimeImpl } from "../runtimeimpl.js";
import { SkillRegistry } from "../skillregistry.js";
import { SkillId } from "../runtime.js";

console.log("=== Testing Comparison Constraints in Skills ===\n");

const runtime = new RuntimeImpl();
const executor = new SkillExecutor(runtime);
const registry = new SkillRegistry();

// Test skill using gte (greater than or equal)
await registry.add({
  id: "test_sqrt_nonneg" as SkillId,
  name: "Test sqrt with gte constraint",
  payload: {
    kind: "macro_action",
    budget: 1,
    skillBody: "sqrt(?a) => do [sqrt(?a) => calc_sqrt(?a) where [gte(?a, 0)]]" as any,
  },
  tags: ["test"],
});

// Test skill using gt (greater than)
await registry.add({
  id: "test_log_positive" as SkillId,
  name: "Test log with gt constraint",
  payload: {
    kind: "macro_action",
    budget: 1,
    skillBody: "log(?a) => do [log(?a) => calc_ln(?a) where [gt(?a, 0)]]" as any,
  },
  tags: ["test"],
});

console.log("Skills loaded\n");

// Test 1: sqrt with non-negative number (should apply)
try {
  console.log("Test 1: sqrt(4) with gte constraint (should apply)");
  const skill = registry.get("test_sqrt_nonneg" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("sqrt(4)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied) {
    console.log("✓ Test 1 passed\n");
  } else {
    console.log("✗ Test 1 failed (should have applied)\n");
  }
} catch (e) {
  console.log("✗ Test 1 failed with error:", e);
  console.log();
}

// Test 2: sqrt with negative number (should NOT apply)
try {
  console.log("Test 2: sqrt(-4) with gte constraint (should NOT apply)");
  const skill = registry.get("test_sqrt_nonneg" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("sqrt(neg(4))");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (!result.applied) {
    console.log("✓ Test 2 passed\n");
  } else {
    console.log("✗ Test 2 failed (should NOT have applied)\n");
  }
} catch (e) {
  console.log("✗ Test 2 failed with error:", e);
  console.log();
}

// Test 3: sqrt(0) with gte constraint (should apply)
try {
  console.log("Test 3: sqrt(0) with gte constraint (should apply)");
  const skill = registry.get("test_sqrt_nonneg" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("sqrt(0)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied) {
    console.log("✓ Test 3 passed\n");
  } else {
    console.log("✗ Test 3 failed (should have applied)\n");
  }
} catch (e) {
  console.log("✗ Test 3 failed with error:", e);
  console.log();
}

// Test 4: log with positive number (should apply)
try {
  console.log("Test 4: log(5) with gt constraint (should apply)");
  const skill = registry.get("test_log_positive" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("log(5)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied) {
    console.log("✓ Test 4 passed\n");
  } else {
    console.log("✗ Test 4 failed (should have applied)\n");
  }
} catch (e) {
  console.log("✗ Test 4 failed with error:", e);
  console.log();
}

// Test 5: log(0) with gt constraint (should NOT apply)
try {
  console.log("Test 5: log(0) with gt constraint (should NOT apply)");
  const skill = registry.get("test_log_positive" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("log(0)");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (!result.applied) {
    console.log("✓ Test 5 passed\n");
  } else {
    console.log("✗ Test 5 failed (should NOT have applied)\n");
  }
} catch (e) {
  console.log("✗ Test 5 failed with error:", e);
  console.log();
}

console.log("=== All comparison constraint tests completed ===");

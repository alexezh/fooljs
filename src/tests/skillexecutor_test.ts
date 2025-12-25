import { AstNode } from "../ast.js";
import { parse } from "../parser.js";
import { SkillExecutor } from "../skillexecutor.js";
import { SkillDescriptor } from "../skilldescriptor.js";
import { RuntimeImpl } from "../runtimeimpl.js";

console.log("=== Testing SkillExecutor with 'do' blocks ===\n");

// Create a runtime instance
const runtime = new RuntimeImpl();
const executor = new SkillExecutor(runtime);

// Test 1: Simple skill with do block
try {
  console.log("Test 1: Apply skill with do block");

  const skillBody = "eq(?lhs, ?rhs) => do [eq(?lhs, ?rhs) => eq(sub(?lhs, ?rhs), 0), eq(sub(?a, ?b), 0) => eq(sum(?a, neg(?b)), 0)]";

  const skill: SkillDescriptor = {
    id: "test_skill" as any,
    name: "test_skill",
    payload: {
      kind: "macro_action",
      skillBody: skillBody as any,
      budget: 10
    }
  };

  // Test input: eq(x, 5)
  const input = parse("eq(x, 5)");
  console.log("Input:", input.toString());

  // Apply the skill at root focus
  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });

  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied) {
    console.log("✓ Test 1 passed\n");
  } else {
    console.log("✗ Test 1 failed: skill was not applied\n");
  }
} catch (e) {
  console.log("✗ Test 1 failed with error:", e);
  console.log();
}

// Test 2: Multiple rule applications
try {
  console.log("Test 2: Multiple rule applications in sequence");

  const skillBody = "eq(?lhs, ?rhs) => do [eq(?lhs, ?rhs) => eq(sub(?lhs, ?rhs), 0), eq(sub(?a, ?b), 0) => eq(sum(?a, neg(?b)), 0)]";

  const skill: SkillDescriptor = {
    id: "test_skill_2" as any,
    name: "test_skill_2",
    payload: {
      kind: "macro_action",
      skillBody: skillBody as any,
      budget: 10
    }
  };

  // Test input: eq(sum(x, 3), 5)
  const input = parse("eq(sum(x, 3), 5)");
  console.log("Input:", input.toString());

  // Apply the skill at root focus
  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });

  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (result.applied) {
    console.log("✓ Test 2 passed\n");
  } else {
    console.log("✗ Test 2 failed: skill was not applied\n");
  }
} catch (e) {
  console.log("✗ Test 2 failed with error:", e);
  console.log();
}

// Test 3: Rule that doesn't match (should return original)
try {
  console.log("Test 3: Rule that doesn't match");

  const skillBody = "sum(?a, ?b) => do [mul(?a, ?b) => mul(?b, ?a)]";

  const skill: SkillDescriptor = {
    id: "test_skill_3" as any,
    name: "test_skill_3",
    payload: {
      kind: "macro_action",
      skillBody: skillBody as any,
      budget: 10
    }
  };

  // Test input: sum(2, 3) - pattern matches, but inner rule doesn't
  const input = parse("sum(2, 3)");
  console.log("Input:", input.toString());

  // Apply the skill at root focus
  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });

  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  // The skill pattern matches, but the inner rule doesn't, so it should still return applied=false
  // because no transformations were actually made
  if (!result.applied && result.nextRoot.toString() === input.toString()) {
    console.log("✓ Test 3 passed\n");
  } else {
    console.log("✗ Test 3 failed\n");
  }
} catch (e) {
  console.log("✗ Test 3 failed with error:", e);
  console.log();
}

console.log("=== All tests completed ===");

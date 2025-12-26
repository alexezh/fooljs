import { parse } from "../parser.js";
import { SkillExecutor } from "../skillexecutor.js";
import { RuntimeImpl } from "../runtimeimpl.js";
import { SkillRegistry } from "../skillregistry.js";
import { SkillId } from "../runtime.js";
import { AstNode, ASymbol } from "../ast.js";
import { is_symbol_name, is_number, is_func } from "../constraintfuncs.js";

console.log("=== Testing Type Constraint Functions ===\n");

// Test type constraint functions directly
console.log("Test is_symbol_name:");
console.log("  is_symbol_name(x):", is_symbol_name([AstNode.create('symbol', new ASymbol('x'))])?.toString(), "expected: 1");
console.log("  is_symbol_name(5):", is_symbol_name([AstNode.create('number', 5)])?.toString(), "expected: 0");
console.log();

console.log("Test is_number:");
console.log("  is_number(5):", is_number([AstNode.create('number', 5)])?.toString(), "expected: 1");
console.log("  is_number(x):", is_number([AstNode.create('symbol', new ASymbol('x'))])?.toString(), "expected: 0");
console.log();

console.log("Test is_func:");
const sumNode = AstNode.create('func', 'sum', [AstNode.create('number', 1), AstNode.create('number', 2)]);
console.log("  is_func(sum(1,2)):", is_func([sumNode])?.toString(), "expected: 1");
console.log("  is_func(5):", is_func([AstNode.create('number', 5)])?.toString(), "expected: 0");
console.log();

// Test in skills
const runtime = new RuntimeImpl();
const executor = new SkillExecutor(runtime);
const registry = new SkillRegistry();

// Test skill using is_symbol_name
await registry.add({
  id: "test_symbol_constraint" as SkillId,
  name: "Test symbol constraint",
  payload: {
    kind: "macro_action",
    budget: 1,
    skillBody: "sym(?x) => do [sym(?x) => marked_symbol(?x) where [is_symbol_name(?x)]]" as any,
  },
  tags: ["test"],
});

// Test skill using is_number
await registry.add({
  id: "test_number_constraint" as SkillId,
  name: "Test number constraint",
  payload: {
    kind: "macro_action",
    budget: 1,
    skillBody: "?n => do [?n => marked_number(?n) where [is_number(?n)]]" as any,
  },
  tags: ["test"],
});

console.log("Skills loaded\n");

// Test 1: is_symbol_name constraint (should apply)
try {
  console.log("Test 1: sym(x) with is_symbol_name constraint (should apply)");
  const skill = registry.get("test_symbol_constraint" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("sym(x)");
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

// Test 2: is_symbol_name constraint with number (should NOT apply)
try {
  console.log("Test 2: sym(5) with is_symbol_name constraint (should NOT apply)");
  const skill = registry.get("test_symbol_constraint" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("sym(5)");
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

// Test 3: is_number constraint (should apply)
try {
  console.log("Test 3: 42 with is_number constraint (should apply)");
  const skill = registry.get("test_number_constraint" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("42");
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

// Test 4: is_number constraint with symbol (should NOT apply)
try {
  console.log("Test 4: x with is_number constraint (should NOT apply)");
  const skill = registry.get("test_number_constraint" as any);
  if (!skill) throw new Error("Skill not found");

  const input = parse("x");
  console.log("Input:", input.toString());

  const result = executor.tryExecute(skill, input, [], { kind: 'solve' });
  console.log("Applied:", result.applied);
  console.log("Result:", result.nextRoot.toString());

  if (!result.applied) {
    console.log("✓ Test 4 passed\n");
  } else {
    console.log("✗ Test 4 failed (should NOT have applied)\n");
  }
} catch (e) {
  console.log("✗ Test 4 failed with error:", e);
  console.log();
}

console.log("=== All type constraint tests completed ===");

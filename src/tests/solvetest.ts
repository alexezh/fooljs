import { AstNode, ASymbol } from "../ast.js";
import { initCore } from "../rules/ruletable.js";
import { Runtime } from "../runtime.js";

console.log("=== Solve and Eq Tests ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Helper to create symbols
function sym(name: string): AstNode {
  return AstNode.create('symbol', new ASymbol(name));
}

// Helper to create solved_for goal
function solvedFor(varName: string): AstNode {
  return AstNode.create('func', 'solved_for', [sym(varName)]);
}

console.log("-- Test 1: Equation symmetry --");
// eq(5, x) => eq(x, 5)
const eq1 = AstNode.create('eq', 'eq', [
  AstNode.create('number', 5),
  sym('x')
]);
console.log(`Input: ${eq1.toString()}`);

const results1 = Runtime.instance.matchRule(eq1);
console.log(`Found ${results1.length} transformations:`);
for (const result of results1) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 2: Solve isolated variable (left) --");
// solve(eq(x, 5), solved_for(x)) => 5
const solve2 = AstNode.create('func', 'solve', [
  AstNode.create('eq', 'eq', [sym('x'), AstNode.create('number', 5)]),
  solvedFor('x')
]);
console.log(`Input: ${solve2.toString()}`);

const results2 = Runtime.instance.matchRule(solve2);
console.log(`Found ${results2.length} transformations:`);
for (const result of results2) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 3: Solve isolated variable (right) --");
// solve(eq(5, x), solved_for(x)) => 5
const solve3 = AstNode.create('func', 'solve', [
  AstNode.create('eq', 'eq', [AstNode.create('number', 5), sym('x')]),
  solvedFor('x')
]);
console.log(`Input: ${solve3.toString()}`);

const results3 = Runtime.instance.matchRule(solve3);
console.log(`Found ${results3.length} transformations:`);
for (const result of results3) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 4: Normalize equation --");
// solve(eq(x, 5), solved_for(x)) should NOT normalize (already has constant on right)
// solve(eq(x + 1, 5), solved_for(x)) => solve(eq((x + 1) - 5, 0), solved_for(x))
const solve4 = AstNode.create('func', 'solve', [
  AstNode.create('eq', 'eq', [
    AstNode.create('func', 'sum', [sym('x'), AstNode.create('number', 1)]),
    AstNode.create('number', 5)
  ]),
  solvedFor('x')
]);
console.log(`Input: ${solve4.toString()}`);

const results4 = Runtime.instance.matchRule(solve4);
console.log(`Found ${results4.length} transformations:`);
for (const result of results4) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 5: Solve linear equation --");
// solve(eq(sum(mul(2, x), 3), 0), solved_for(x)) => div(neg(3), 2) = -3/2
const solve5 = AstNode.create('func', 'solve', [
  AstNode.create('eq', 'eq', [
    AstNode.create('func', 'sum', [
      AstNode.create('func', 'mul', [AstNode.create('number', 2), sym('x')]),
      AstNode.create('number', 3)
    ]),
    AstNode.create('number', 0)
  ]),
  solvedFor('x')
]);
console.log(`Input: ${solve5.toString()}`);
console.log(`This represents: 2x + 3 = 0`);

const results5 = Runtime.instance.matchRule(solve5);
console.log(`Found ${results5.length} transformations:`);
for (const result of results5) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 6: Solve linear equation (reverse order) --");
// solve(eq(sum(3, mul(2, x)), 0), solved_for(x)) => div(neg(3), 2)
const solve6 = AstNode.create('func', 'solve', [
  AstNode.create('eq', 'eq', [
    AstNode.create('func', 'sum', [
      AstNode.create('number', 3),
      AstNode.create('func', 'mul', [AstNode.create('number', 2), sym('x')])
    ]),
    AstNode.create('number', 0)
  ]),
  solvedFor('x')
]);
console.log(`Input: ${solve6.toString()}`);
console.log(`This represents: 3 + 2x = 0`);

const results6 = Runtime.instance.matchRule(solve6);
console.log(`Found ${results6.length} transformations:`);
for (const result of results6) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 7: Solve linear equation (x on left side of mul) --");
// solve(eq(sum(mul(x, 2), 3), 0), solved_for(x)) => div(neg(3), 2)
const solve7 = AstNode.create('func', 'solve', [
  AstNode.create('eq', 'eq', [
    AstNode.create('func', 'sum', [
      AstNode.create('func', 'mul', [sym('x'), AstNode.create('number', 2)]),
      AstNode.create('number', 3)
    ]),
    AstNode.create('number', 0)
  ]),
  solvedFor('x')
]);
console.log(`Input: ${solve7.toString()}`);
console.log(`This represents: x*2 + 3 = 0`);

const results7 = Runtime.instance.matchRule(solve7);
console.log(`Found ${results7.length} transformations:`);
for (const result of results7) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 8: Goal already met --");
// solve(5, solved_for(x)) => 5 (goal holds because result is a number)
const solve8 = AstNode.create('func', 'solve', [
  AstNode.create('number', 5),
  solvedFor('x')
]);
console.log(`Input: ${solve8.toString()}`);

const results8 = Runtime.instance.matchRule(solve8);
console.log(`Found ${results8.length} transformations:`);
for (const result of results8) {
  console.log(`  ${result.toString()}`);
}

console.log("\n=== Tests Complete ===");

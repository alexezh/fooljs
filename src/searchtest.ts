import { parse } from "./parser.js";
import { aStarSearch, simplify, isGoal } from "./search.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";
import { AstNode, ASymbol } from "./ast.js";

console.log("=== Search Tests ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

console.log("-- Test 1: Simple evaluation --");
const expr1 = parse("eval(sum(2, 3))");
console.log(`Input: ${expr1.toString()}`);
console.log(`Cost: ${expr1.getCost()}`);
console.log(`Is goal: ${isGoal(expr1)}`);

const path1 = aStarSearch(expr1);
if (path1) {
  console.log(`Found path with ${path1.length} steps:`);
  for (let i = 0; i < path1.length; i++) {
    console.log(`  Step ${i}: ${path1[i].toString()} (cost: ${path1[i].getCost()})`);
  }
} else {
  console.log("No path found");
}

console.log("\n-- Test 2: Greedy simplification --");
const expr2 = parse("eval(sum(2, 3))");
console.log(`Input: ${expr2.toString()} (cost: ${expr2.getCost()})`);

const result2 = simplify(expr2);
console.log(`Result: ${result2.toString()} (cost: ${result2.getCost()})`);

console.log("\n-- Test 3: Zero removal --");
const expr3 = parse("sum(5, 0)");
console.log(`Input: ${expr3.toString()} (cost: ${expr3.getCost()})`);
console.log(`Is goal: ${isGoal(expr3)}`);

const path3 = aStarSearch(expr3);
if (path3) {
  console.log(`Found path with ${path3.length} steps:`);
  for (let i = 0; i < path3.length; i++) {
    console.log(`  Step ${i}: ${path3[i].toString()} (cost: ${path3[i].getCost()})`);
  }
} else {
  console.log("No path found");
}

console.log("\n-- Test 4: Already at goal --");
const expr4 = parse("5");
console.log(`Input: ${expr4.toString()} (cost: ${expr4.getCost()})`);
console.log(`Is goal: ${isGoal(expr4)}`);

const path4 = aStarSearch(expr4);
if (path4) {
  console.log(`Path has ${path4.length} step(s):`);
  for (let i = 0; i < path4.length; i++) {
    console.log(`  Step ${i}: ${path4[i].toString()}`);
  }
} else {
  console.log("No path found");
}

console.log("\n-- Test 5: Complex expression --");
const expr5 = parse("sum(1, 2, 0, 3)");
console.log(`Input: ${expr5.toString()} (cost: ${expr5.getCost()})`);

const result5 = simplify(expr5);
console.log(`Simplified: ${result5.toString()} (cost: ${result5.getCost()})`);

console.log("\n" + "=".repeat(80));
console.log("EQUATION SOLVING TESTS");
console.log("=".repeat(80));

console.log("\n-- Test 6: Solve already-solved equation (x = 5) --");
const eq1 = parse("x = 5");
const solve1 = AstNode.create('func', 'solve', [
  eq1,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input: ${solve1.toString()}`);
console.log(`Cost: ${solve1.getCost()}`);

const path1 = aStarSearch(solve1);
if (path1) {
  console.log(`Search found path with ${path1.length} steps:`);
  for (let i = 0; i < path1.length; i++) {
    console.log(`  Step ${i}: ${path1[i].toString()} (cost: ${path1[i].getCost()})`);
  }
  console.log(`Final solution: x = ${path1[path1.length - 1].toString()}`);
} else {
  console.log("No search path found");
}

console.log("\n-- Test 7: Solve linear equation in standard form (2x + 3 = 0) --");
const eq2 = parse("2x + 3 = 0");
const solve2 = AstNode.create('func', 'solve', [
  eq2,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input equation: ${eq2.toString()}`);
console.log(`Solve expression: ${solve2.toString()}`);
console.log(`Cost: ${solve2.getCost()}`);

const path2 = aStarSearch(solve2);
if (path2) {
  console.log(`Search found path with ${path2.length} steps:`);
  for (let i = 0; i < path2.length; i++) {
    console.log(`  Step ${i}: ${path2[i].toString()} (cost: ${path2[i].getCost()})`);
  }
  console.log(`Final solution: x = ${path2[path2.length - 1].toString()}`);
} else {
  console.log("No search path found");
}

console.log("\n-- Test 8: Solve linear equation needing normalization (2x + 3 = 7) --");
const eq3 = parse("2x + 3 = 7");
const solve3 = AstNode.create('func', 'solve', [
  eq3,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input equation: ${eq3.toString()}`);
console.log(`Solve expression: ${solve3.toString()}`);
console.log(`Cost: ${solve3.getCost()}`);

const path3 = aStarSearch(solve3);
if (path3) {
  console.log(`Search found path with ${path3.length} steps:`);
  for (let i = 0; i < path3.length; i++) {
    console.log(`  Step ${i}: ${path3[i].toString()} (cost: ${path3[i].getCost()})`);
  }
  console.log(`Final solution: x = ${path3[path3.length - 1].toString()}`);
} else {
  console.log("No search path found");
}

console.log("\n-- Test 9: Solve with swapped sides (5 = x) --");
const eq4 = parse("5 = x");
const solve4 = AstNode.create('func', 'solve', [
  eq4,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input: ${solve4.toString()}`);
console.log(`Cost: ${solve4.getCost()}`);

const path4 = aStarSearch(solve4);
if (path4) {
  console.log(`Search found path with ${path4.length} steps:`);
  for (let i = 0; i < path4.length; i++) {
    console.log(`  Step ${i}: ${path4[i].toString()} (cost: ${path4[i].getCost()})`);
  }
  console.log(`Final solution: x = ${path4[path4.length - 1].toString()}`);
} else {
  console.log("No search path found");
}

console.log("\n-- Test 10: Detailed search path for linear equation (3x + 6 = 0) --");
const eq5 = parse("3x + 6 = 0");
const solve5 = AstNode.create('func', 'solve', [
  eq5,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input equation: ${eq5.toString()}`);
console.log(`Solve expression: ${solve5.toString()}`);
console.log(`Initial cost: ${solve5.getCost()}`);

const path5 = aStarSearch(solve5);
if (path5) {
  console.log(`\nSearch found path with ${path5.length} steps:`);
  for (let i = 0; i < path5.length; i++) {
    const step = path5[i];
    console.log(`  Step ${i}: ${step.toString()}`);
    console.log(`           Cost: ${step.getCost()}`);
  }
  console.log(`\nFinal solution: x = ${path5[path5.length - 1].toString()}`);
} else {
  console.log("\nNo search path found");
}

console.log("\n=== Tests Complete ===");

import { parse } from "./parser.js";
import { aStarSearch, simplify, isGoal } from "./search.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

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

console.log("\n=== Tests Complete ===");

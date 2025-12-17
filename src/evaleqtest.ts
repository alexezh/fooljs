import { parse } from "./parser.js";
import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

console.log("=== Eval Eq Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Test: eval(eq(5, 3))
console.log("-- Test: eval(eq(5, 3)) --");
const eq1 = AstNode.create('eq', 'eq', [
  AstNode.create('number', 5),
  AstNode.create('number', 3)
]);
const evalEq1 = AstNode.create('func', 'eval', [eq1]);
console.log(`Expression: ${evalEq1.toString()}`);
console.log(`Cost: ${evalEq1.getCost()}`);

const matches1 = Runtime.instance.matchRule(evalEq1);
console.log(`Found ${matches1.length} transformations:`);
for (const match of matches1) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test: eval(eq(sum(2,3), 7))
console.log("-- Test: eval(eq(sum(2,3), 7)) --");
const eq2 = AstNode.create('eq', 'eq', [
  parse("sum(2,3)"),
  AstNode.create('number', 7)
]);
const evalEq2 = AstNode.create('func', 'eval', [eq2]);
console.log(`Expression: ${evalEq2.toString()}`);
console.log(`Cost: ${evalEq2.getCost()}`);

const matches2 = Runtime.instance.matchRule(evalEq2);
console.log(`Found ${matches2.length} transformations:`);
for (const match of matches2) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

console.log("=== Test Complete ===");

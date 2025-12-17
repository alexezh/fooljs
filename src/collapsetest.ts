import { parse } from "./parser.js";
import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

console.log("=== Eval Collapse Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Test 1: Direct eval(eval(...))
console.log("-- Test 1: eval(eval(5)) --");
const double = AstNode.create('func', 'eval', [
  AstNode.create('func', 'eval', [
    AstNode.create('number', 5)
  ])
]);
console.log(`Expression: ${double.toString()}`);
console.log(`Cost: ${double.getCost()}`);

const matches1 = Runtime.instance.matchRule(double);
console.log(`Found ${matches1.length} transformations:`);
for (const match of matches1) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test 2: Triple eval
console.log("-- Test 2: eval(eval(eval(x))) --");
const triple = AstNode.create('func', 'eval', [
  AstNode.create('func', 'eval', [
    AstNode.create('func', 'eval', [
      parse("x")
    ])
  ])
]);
console.log(`Expression: ${triple.toString()}`);
console.log(`Cost: ${triple.getCost()}`);

const matches2 = Runtime.instance.matchRule(triple);
console.log(`Found ${matches2.length} transformations:`);
for (const match of matches2) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

console.log("=== Test Complete ===");

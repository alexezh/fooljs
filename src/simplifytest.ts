import { parse } from "./parser.js";
import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

console.log("=== Direct Simplify Rules Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Test 1: Direct like terms combination
console.log("-- Test 1: eval(sum(mul(7,x), mul(3,x))) --");
const sum1 = parse("sum(mul(7,x), mul(3,x))");
const eval1 = AstNode.create('func', 'eval', [sum1]);
console.log(`Expression: ${eval1.toString()}`);
console.log(`Cost: ${eval1.getCost()}`);

const matches1 = Runtime.instance.matchRule(eval1);
console.log(`Found ${matches1.length} transformations:`);
for (const match of matches1) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test 2: Like terms with constant
console.log("-- Test 2: eval(sum(mul(7,x), mul(3,x), 2)) --");
const sum2 = parse("sum(mul(7,x), mul(3,x), 2)");
const eval2 = AstNode.create('func', 'eval', [sum2]);
console.log(`Expression: ${eval2.toString()}`);
console.log(`Cost: ${eval2.getCost()}`);

const matches2 = Runtime.instance.matchRule(eval2);
console.log(`Found ${matches2.length} transformations:`);
for (const match of matches2) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test 3: Sub expansion
console.log("-- Test 3: eval(sub(sum(mul(7,x), mul(3,x), 2), 3)) --");
const sub3 = parse("sub(sum(mul(7,x), mul(3,x), 2), 3)");
const eval3 = AstNode.create('func', 'eval', [sub3]);
console.log(`Expression: ${eval3.toString()}`);
console.log(`Cost: ${eval3.getCost()}`);

const matches3 = Runtime.instance.matchRule(eval3);
console.log(`Found ${matches3.length} transformations:`);
for (const match of matches3) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test 4: Combine numbers
console.log("-- Test 4: eval(sum(7, 3)) --");
const sum4 = parse("sum(7, 3)");
const eval4 = AstNode.create('func', 'eval', [sum4]);
console.log(`Expression: ${eval4.toString()}`);
console.log(`Cost: ${eval4.getCost()}`);

const matches4 = Runtime.instance.matchRule(eval4);
console.log(`Found ${matches4.length} transformations:`);
for (const match of matches4) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

console.log("=== Test Complete ===");

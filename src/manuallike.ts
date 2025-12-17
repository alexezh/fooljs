import { parse } from "./parser.js";
import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

console.log("=== Manual Like Terms Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Manually construct eval(sum(x, x))
console.log("-- Test: eval(sum(x, x)) --");
const sum1 = parse("sum(x, x)");
const eval1 = AstNode.create('func', 'eval', [sum1]);
console.log(`Expression: ${eval1.toString()}`);

const matches1 = Runtime.instance.matchRule(eval1);
console.log(`Found ${matches1.length} transformations:`);
for (const match of matches1) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Manually construct eval(sum(mul(7,x), mul(3,x)))
console.log("-- Test: eval(sum(mul(7,x), mul(3,x))) --");
const sum2 = parse("sum(mul(7,x), mul(3,x))");
const eval2 = AstNode.create('func', 'eval', [sum2]);
console.log(`Expression: ${eval2.toString()}`);

const matches2 = Runtime.instance.matchRule(eval2);
console.log(`Found ${matches2.length} transformations:`);
for (const match of matches2) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Manually construct eval(sum(mul(7,x), mul(3,x), 2))
console.log("-- Test: eval(sum(mul(7,x), mul(3,x), 2)) --");
const sum3 = parse("sum(mul(7,x), mul(3,x), 2)");
const eval3 = AstNode.create('func', 'eval', [sum3]);
console.log(`Expression: ${eval3.toString()}`);

const matches3 = Runtime.instance.matchRule(eval3);
console.log(`Found ${matches3.length} transformations:`);
for (const match of matches3) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

console.log("=== Test Complete ===");

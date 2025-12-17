import { parse } from "./parser.js";
import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

console.log("=== Sqrt2 Rule Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Test 1: eval(sqrt(pow(5, 2)))
console.log("-- Test 1: eval(sqrt(pow(5, 2))) --");
const expr1 = AstNode.create('func', 'eval', [
  AstNode.create('func', 'sqrt', [
    AstNode.create('func', 'pow', [
      AstNode.create('number', 5),
      AstNode.create('number', 2)
    ])
  ])
]);
console.log(`Expression: ${expr1.toString()}`);
console.log(`Cost: ${expr1.getCost()}`);

const matches1 = Runtime.instance.matchRule(expr1);
console.log(`Found ${matches1.length} transformations:`);
for (const match of matches1) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test 2: eval(sqrt(pow(x, 2)))
console.log("-- Test 2: eval(sqrt(pow(x, 2))) --");
const expr2 = AstNode.create('func', 'eval', [
  AstNode.create('func', 'sqrt', [
    AstNode.create('func', 'pow', [
      parse("x"),
      AstNode.create('number', 2)
    ])
  ])
]);
console.log(`Expression: ${expr2.toString()}`);
console.log(`Cost: ${expr2.getCost()}`);

const matches2 = Runtime.instance.matchRule(expr2);
console.log(`Found ${matches2.length} transformations:`);
for (const match of matches2) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test 3: eval(sqrt(pow(sum(x,1), 2)))
console.log("-- Test 3: eval(sqrt(pow(sum(x,1), 2))) --");
const expr3 = AstNode.create('func', 'eval', [
  AstNode.create('func', 'sqrt', [
    AstNode.create('func', 'pow', [
      parse("sum(x,1)"),
      AstNode.create('number', 2)
    ])
  ])
]);
console.log(`Expression: ${expr3.toString()}`);
console.log(`Cost: ${expr3.getCost()}`);

const matches3 = Runtime.instance.matchRule(expr3);
console.log(`Found ${matches3.length} transformations:`);
for (const match of matches3) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Test 4: Should NOT match - eval(sqrt(pow(x, 3)))
console.log("-- Test 4: eval(sqrt(pow(x, 3))) (should NOT match ruleSqrt2) --");
const expr4 = AstNode.create('func', 'eval', [
  AstNode.create('func', 'sqrt', [
    AstNode.create('func', 'pow', [
      parse("x"),
      AstNode.create('number', 3)
    ])
  ])
]);
console.log(`Expression: ${expr4.toString()}`);
console.log(`Cost: ${expr4.getCost()}`);

const matches4 = Runtime.instance.matchRule(expr4);
console.log(`Found ${matches4.length} transformations:`);
for (const match of matches4) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
const hasRuleSqrt2 = matches4.some(m => m.toString() === 'x');
console.log(`ruleSqrt2 matched: ${hasRuleSqrt2} (expected: false)`);
console.log();

console.log("=== Test Complete ===");

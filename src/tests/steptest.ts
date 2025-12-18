import { parse } from "../parser.js";
import { AstNode, ASymbol } from "../ast.js";
import { Runtime } from "../runtime.js";
import { initCore } from "../rules/ruletable.js";

console.log("=== Step Rule Tests ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

console.log("-- Test 1: step on div(neg(3), 2) --");
const expr1 = parse("div(neg(3), 2)");
console.log(`Expression: ${expr1.toString()}`);

const stepExpr1 = AstNode.create('func', 'step', [expr1]);
console.log(`Step expression: ${stepExpr1.toString()}`);

const stepResults1 = Runtime.instance.matchRule(stepExpr1);
console.log(`Found ${stepResults1.length} step results:`);
for (const result of stepResults1) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 2: step on sum(2, 3) --");
const expr2 = parse("sum(2, 3)");
console.log(`Expression: ${expr2.toString()}`);

const stepExpr2 = AstNode.create('func', 'step', [expr2]);
console.log(`Step expression: ${stepExpr2.toString()}`);

const stepResults2 = Runtime.instance.matchRule(stepExpr2);
console.log(`Found ${stepResults2.length} step results:`);
for (const result of stepResults2) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 3: Direct rule check on solve linear --");
const eq3 = parse("2x + 3 = 0");
console.log(`Equation: ${eq3.toString()}`);

const solve3 = AstNode.create('func', 'solve', [
  eq3,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Solve expression: ${solve3.toString()}`);

const solveResults3 = Runtime.instance.matchRule(solve3);
console.log(`Found ${solveResults3.length} solve transformations:`);
for (const result of solveResults3) {
  console.log(`  ${result.toString()}`);
}

console.log("\n=== Tests Complete ===");

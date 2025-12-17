import { parse } from "./parser.js";
import { AstNode, ASymbol } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

console.log("=== Step Rule Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Test the normalized equation
const normalized = parse("solve(eq(sub(sum(mul(7,x),mul(3,x),2),3),0),solved_for(x))");
console.log(`Normalized: ${normalized.toString()}`);
console.log(`Cost: ${normalized.getCost()}\n`);

// Try to apply step directly to the equation inside
const eqNode = (normalized.children as AstNode[])[0]; // eq(sub(...), 0)
console.log(`Equation node: ${eqNode.toString()}`);
console.log(`Cost: ${eqNode.getCost()}\n`);

// Try step on equation
console.log("-- Try step on equation --");
const stepEq = AstNode.create('func', 'step', [eqNode]);
const stepMatches = Runtime.instance.matchRule(stepEq);
console.log(`Found ${stepMatches.length} transformations:`);
for (const match of stepMatches) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Try eval on equation
console.log("-- Try eval on equation --");
const evalEq = AstNode.create('func', 'eval', [eqNode]);
const evalMatches = Runtime.instance.matchRule(evalEq);
console.log(`Found ${evalMatches.length} transformations:`);
for (const match of evalMatches) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// Try step on the sub expression
const subNode = (eqNode.children as AstNode[])[0]; // sub(sum(...), 3)
console.log(`Sub node: ${subNode.toString()}`);
console.log(`Cost: ${subNode.getCost()}\n`);

console.log("-- Try eval on sub expression --");
const evalSub = AstNode.create('func', 'eval', [subNode]);
const evalSubMatches = Runtime.instance.matchRule(evalSub);
console.log(`Found ${evalSubMatches.length} transformations:`);
for (const match of evalSubMatches) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

// If we expand sub to sum, then what?
if (evalSubMatches.length > 0) {
  const expanded = evalSubMatches.find(m => m.toString().includes('sum'));
  if (expanded) {
    console.log(`-- After sub expansion: ${expanded.toString()} --`);
    const expandedMatches = Runtime.instance.matchRule(expanded);
    console.log(`Found ${expandedMatches.length} transformations:`);
    for (const match of expandedMatches) {
      console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
    }
    console.log();
  }
}

console.log("=== Test Complete ===");

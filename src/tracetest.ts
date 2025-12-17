import { parse } from "./parser.js";
import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";

console.log("=== Full Evaluation Trace ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Start from normalized solve
let current = parse("solve(eq(sub(sum(mul(7,x),mul(3,x),2),3),0),solved_for(x))");
console.log(`Step 0: ${current.toString()}`);
console.log(`        Cost: ${current.getCost()}\n`);

// Manual step-by-step evaluation
for (let step = 1; step <= 15; step++) {
  const matches = Runtime.instance.matchRule(current);

  if (matches.length === 0) {
    console.log(`Step ${step}: No more transformations found\n`);
    break;
  }

  console.log(`Step ${step}: Found ${matches.length} transformations:`);
  for (let i = 0; i < Math.min(matches.length, 5); i++) {
    const match = matches[i];
    console.log(`  [${i}] ${match.toString()} (cost: ${match.getCost()})`);
  }

  // Pick the lowest cost one
  const best = matches.reduce((a, b) => a.getCost() < b.getCost() ? a : b);
  current = best;
  console.log(`  → Using: ${current.toString()}`);
  console.log(`           Cost: ${current.getCost()}\n`);

  // Check if we've solved it
  if (current.kind === 'number') {
    console.log(`SOLVED! Result: ${current.toString()}\n`);
    break;
  }
}

console.log(`Final: ${current.toString()}`);
console.log(`       Cost: ${current.getCost()}\n`);

console.log("=== Trace Complete ===");

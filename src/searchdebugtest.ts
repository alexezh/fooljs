import { parse } from "./parser.js";
import { AstNode, ASymbol } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";
import { aStarSearch } from "./search.js";

console.log("=== A* Search Debug Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

console.log("-- Testing: solve(eq(3x + 6, 0), solved_for(x)) --\n");

const eq = parse("3x + 6 = 0");
console.log(`Parsed equation: ${eq.toString()}`);

const solve = AstNode.create('func', 'solve', [
  eq,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Solve expression: ${solve.toString()}`);
console.log(`Initial cost: ${solve.getCost()}\n`);

// Step 1: Check what rules match directly
console.log("Step 1 - Direct rule matches:");
const directMatches = Runtime.instance.matchRule(solve);
console.log(`Found ${directMatches.length} direct transformations:`);
for (const match of directMatches) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}

if (directMatches.length > 0) {
  const firstMatch = directMatches[0];
  console.log(`\nStep 2 - Checking rules on first match: ${firstMatch.toString()}`);
  const secondMatches = Runtime.instance.matchRule(firstMatch);
  console.log(`Found ${secondMatches.length} transformations:`);
  for (const match of secondMatches) {
    console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
  }
}

console.log(`\n${"=".repeat(80)}`);
console.log("Step 3 - Running A* search with increased max states:");
const path = aStarSearch(solve, Runtime.instance, undefined, 50000)?.getPath();
if (path) {
  console.log(`\nSuccess! Found path with ${path.length} steps:`);
  for (let i = 0; i < path.length; i++) {
    console.log(`  Step ${i}: ${path[i].toString()} (cost: ${path[i].getCost()})`);
  }
} else {
  console.log("\nNo path found even with 50,000 max states");
}

console.log(`\n${"=".repeat(80)}`);
console.log("Step 4 - Test solve directly to see if it reaches a goal:");

// Manually apply rules to see the path
let current = solve;
let step = 0;
const maxSteps = 20;

console.log(`\nManual step-by-step application:`);
console.log(`  Step ${step}: ${current.toString()} (cost: ${current.getCost()})`);

for (step = 1; step <= maxSteps; step++) {
  const matches = Runtime.instance.matchRule(current);

  if (matches.length === 0) {
    console.log(`  No more transformations available.`);
    break;
  }

  // Find the lowest cost match
  let bestMatch = matches[0];
  let bestCost = bestMatch.getCost();

  for (const match of matches) {
    const cost = match.getCost();
    if (cost < bestCost) {
      bestMatch = match;
      bestCost = cost;
    }
  }

  current = bestMatch;
  console.log(`  Step ${step}: ${current.toString()} (cost: ${current.getCost()})`);

  // Check if it's a goal (number or symbol)
  if (current.kind === 'number' || current.kind === 'symbol') {
    console.log(`  ✓ Reached goal!`);
    break;
  }
}

console.log("\n=== Debug Test Complete ===");

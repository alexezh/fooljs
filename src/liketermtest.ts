import { parse } from "./parser.js";
import { AstNode, ASymbol } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";
import { aStarSearch, simplify } from "./search.js";

console.log("=== Like Terms Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

console.log("-- Test: 7x + 3x + 2 = 3 --\n");

const eq = parse("7x + 3x + 2 = 3");
console.log(`Parsed equation: ${eq.toString()}`);
console.log(`Kind: ${eq.kind}`);
console.log(`Cost: ${eq.getCost()}\n`);

const solve = AstNode.create('func', 'solve', [
  eq,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);

console.log(`Solve expression: ${solve.toString()}`);
console.log(`Cost: ${solve.getCost()}\n`);

// Check what rules match directly
console.log("Step 1 - Direct rule matches:");
const directMatches = Runtime.instance.matchRule(solve);
console.log(`Found ${directMatches.length} transformations:`);
for (const match of directMatches) {
  console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
}
console.log();

if (directMatches.length > 0) {
  const normalized = directMatches[0];
  console.log(`Step 2 - After normalization: ${normalized.toString()}`);
  console.log(`Cost: ${normalized.getCost()}\n`);

  const step2Matches = Runtime.instance.matchRule(normalized);
  console.log(`Found ${step2Matches.length} transformations:`);
  for (const match of step2Matches) {
    console.log(`  ${match.toString()} (cost: ${match.getCost()})`);
  }
  console.log();
}

console.log("Step 3 - Try simplify:");
const simplified = simplify(solve);
console.log(`Result: ${simplified.toString()}`);
console.log(`Cost: ${simplified.getCost()}\n`);

console.log("Step 4 - Try A* search:");
const path = aStarSearch(solve, Runtime.instance, undefined, 50000)?.getPath();
if (path) {
  console.log(`Found path with ${path.length} steps:`);
  for (let i = 0; i < path.length; i++) {
    console.log(`  Step ${i}: ${path[i].toString()} (cost: ${path[i].getCost()})`);
  }
} else {
  console.log("No path found\n");
}

console.log("=".repeat(80));
console.log("ANALYSIS:");
console.log("The equation 7x + 3x + 2 = 3 requires combining like terms:");
console.log("  7x + 3x → 10x");
console.log("Then normalizing:");
console.log("  10x + 2 - 3 = 0 → 10x - 1 = 0");
console.log("Then solving:");
console.log("  x = 1/10 = 0.1");
console.log();
console.log("Missing rule: sum(mul(?a, ?x), mul(?b, ?x)) => mul(sum(?a, ?b), ?x)");
console.log("=".repeat(80));

console.log("\n=== Test Complete ===");

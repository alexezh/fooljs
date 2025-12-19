import { parse } from "../parser.js";
import { AstNode, ASymbol } from "../ast.js";
import { Runtime } from "../runtime.js";
import { initCore } from "../ruletable.js";
import { aStarSearch } from "../search.js";

console.log("=== Like Terms A* Trace ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

const eq = parse("7x + 3x + 2 = 3");
const solve = AstNode.create('func', 'solve', [
  eq,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);

console.log(`Starting: ${solve.toString()}`);
console.log(`Cost: ${solve.getCost()}\n`);

console.log("Running A* search with extended limit...\n");
const result = aStarSearch(solve, Runtime.instance, undefined, 100000);

if (result) {
  const path = result.getPath();
  console.log(`Found path with ${path.length} steps:\n`);
  for (let i = 0; i < Math.min(path.length, 20); i++) {
    console.log(`Step ${i}: ${path[i].toString()}`);
    console.log(`        Cost: ${path[i].getCost()}\n`);
  }
  if (path.length > 20) {
    console.log(`... (${path.length - 20} more steps)\n`);
  }
  console.log(`Final: ${path[path.length - 1].toString()}`);
} else {
  console.log("No path found");
  console.log("This likely means the search space was exhausted without finding a goal state.");
  console.log("A goal state is either a number or a symbol.");
}

console.log("\n=== Trace Complete ===");

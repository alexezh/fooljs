import { parse } from "../parser.js";
import { aStarSearch, isGoal } from "../search.js";
import { Runtime } from "../runtime.js";
import { initCore } from "../rules/ruletable.js";
import { AstNode, ASymbol } from "../ast.js";

console.log("=== Search Tests ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

console.log("\n-- Test 7: Solve linear equation in standard form (2x + 3 = 0) --");
const eq2 = parse("2x + 3 = 0");
const solve2 = AstNode.create('func', 'solve', [
  eq2,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input equation: ${eq2.toString()}`);
console.log(`Solve expression: ${solve2.toString()}`);
console.log(`Cost: ${solve2.getCost()}`);


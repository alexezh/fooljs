import { parse } from "../parser.js";
import { AstNode, ASymbol } from "../ast.js";
import { Runtime } from "../runtime.js";
import { initCore } from "../ruletable.js";
import { aStarSearch } from "../search.js";

console.log("=== Simple Solve Test ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Test 1: x = 5 (should work - from searchtest)
console.log("-- Test 1: x = 5 --");
const eq1 = parse("x = 5");
const solve1 = AstNode.create('func', 'solve', [
  eq1,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input: ${solve1.toString()}`);

const result1 = aStarSearch(solve1, Runtime.instance, undefined, 1000);
if (result1) {
  const path1 = result1.getPath();
  console.log(`✓ Found path with ${path1.length} steps`);
  console.log(`Final: ${path1[path1.length - 1].toString()}\n`);
} else {
  console.log(`✗ No path found\n`);
}

// Test 2: 2x + 3 = 0 (should work - from searchtest)
console.log("-- Test 2: 2x + 3 = 0 --");
const eq2 = parse("2x + 3 = 0");
const solve2 = AstNode.create('func', 'solve', [
  eq2,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input: ${solve2.toString()}`);

const result2 = aStarSearch(solve2, Runtime.instance, undefined, 10000);
if (result2) {
  const path2 = result2.getPath();
  console.log(`✓ Found path with ${path2.length} steps`);
  console.log(`Final: ${path2[path2.length - 1].toString()}\n`);
} else {
  console.log(`✗ No path found\n`);
}

// Test 3: x + x = 4 (like terms but simpler)
console.log("-- Test 3: x + x = 4 --");
const eq3 = parse("x + x = 4");
const solve3 = AstNode.create('func', 'solve', [
  eq3,
  AstNode.create('func', 'solved_for', [
    AstNode.create('symbol', new ASymbol('x'))
  ])
]);
console.log(`Input: ${solve3.toString()}`);

const result3 = aStarSearch(solve3, Runtime.instance, undefined, 10000);
if (result3) {
  const path3 = result3.getPath();
  console.log(`✓ Found path with ${path3.length} steps`);
  console.log(`Final: ${path3[path3.length - 1].toString()}\n`);
} else {
  console.log(`✗ No path found\n`);
}

console.log("=== Test Complete ===");

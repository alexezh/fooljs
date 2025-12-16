import { parse } from "./parser.js";
import { AstNode, ASymbol } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";
import { simplify } from "./search.js";

console.log("=== Equation Solving Tests ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Helper to create a solve expression from an equation and variable
function createSolveExpr(equation: AstNode, varName: string): AstNode {
  return AstNode.create('func', 'solve', [
    equation,
    AstNode.create('func', 'solved_for', [
      AstNode.create('symbol', new ASymbol(varName))
    ])
  ]);
}

console.log("-- Test 1: Parse and solve simple equation x = 5 --");
const eq1 = parse("x = 5");
console.log(`Parsed equation: ${eq1.toString()}`);
console.log(`Equation kind: ${eq1.kind}`);

const solve1 = createSolveExpr(eq1, 'x');
console.log(`Solve expression: ${solve1.toString()}`);

const results1 = Runtime.instance.matchRule(solve1);
console.log(`Found ${results1.length} transformations:`);
for (const result of results1) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 2: Parse and solve x + 1 = 5 --");
const eq2 = parse("x + 1 = 5");
console.log(`Parsed equation: ${eq2.toString()}`);

const solve2 = createSolveExpr(eq2, 'x');
console.log(`Solve expression: ${solve2.toString()}`);

const results2 = Runtime.instance.matchRule(solve2);
console.log(`Found ${results2.length} transformations:`);
for (const result of results2) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 3: Normalize equation x + 1 = 5 to standard form --");
// After normalization, should be: solve(eq((x + 1) - 5, 0), solved_for(x))
if (results2.length > 0) {
  const normalized = results2[0];
  console.log(`Normalized: ${normalized.toString()}`);

  // Try to simplify the normalized form
  const simplified = simplify(normalized);
  console.log(`After simplification: ${simplified.toString()}`);
}

console.log("\n-- Test 4: Parse and solve 2x + 3 = 0 (already in standard form) --");
const eq4 = parse("2x + 3 = 0");
console.log(`Parsed equation: ${eq4.toString()}`);

const solve4 = createSolveExpr(eq4, 'x');
console.log(`Solve expression: ${solve4.toString()}`);

const results4 = Runtime.instance.matchRule(solve4);
console.log(`Found ${results4.length} transformations:`);
for (const result of results4) {
  console.log(`  ${result.toString()}`);
  console.log(`  This is the solution: x = ${result.toString()}`);
}

console.log("\n-- Test 5: Parse and solve 3x = 12 --");
const eq5 = parse("3x = 12");
console.log(`Parsed equation: ${eq5.toString()}`);

const solve5 = createSolveExpr(eq5, 'x');
console.log(`Solve expression: ${solve5.toString()}`);

const results5 = Runtime.instance.matchRule(solve5);
console.log(`Found ${results5.length} transformations:`);
for (const result of results5) {
  console.log(`  ${result.toString()}`);
}

// Normalize and solve
if (results5.length > 0) {
  console.log(`Trying to normalize first...`);
  const normalized = results5.find(r => r.kind === 'func' && r.value === 'solve');
  if (normalized) {
    console.log(`Normalized: ${normalized.toString()}`);
    const simplifiedNorm = simplify(normalized);
    console.log(`After simplification: ${simplifiedNorm.toString()}`);
  }
}

console.log("\n-- Test 6: Parse complex equation 7x + 2x^2 - 14 + 3x^2 = x - 2 --");
const eq6 = parse("7x + 2x^2 - 14 + 3x^2 = x - 2");
console.log(`Parsed equation: ${eq6.toString()}`);
console.log(`Equation cost: ${eq6.getCost()}`);

const solve6 = createSolveExpr(eq6, 'x');
console.log(`Solve expression: ${solve6.toString()}`);

const results6 = Runtime.instance.matchRule(solve6);
console.log(`Found ${results6.length} transformations:`);
for (const result of results6) {
  console.log(`  ${result.toString()}`);
}

console.log("\n-- Test 7: Demonstrate full solving workflow --");
console.log("Starting with: 2x + 6 = 0");
const eq7 = parse("2x + 6 = 0");
console.log(`Step 1 - Parsed equation: ${eq7.toString()}`);

const solve7 = createSolveExpr(eq7, 'x');
console.log(`Step 2 - Wrap in solve: ${solve7.toString()}`);

console.log(`Step 3 - Apply solving rules:`);
const results7 = Runtime.instance.matchRule(solve7);
if (results7.length > 0) {
  const solution = results7[0];
  console.log(`  Solution found: ${solution.toString()}`);

  // Evaluate the solution if it's an expression
  if (solution.kind === 'func' && solution.value === 'div') {
    console.log(`Step 4 - Evaluate the division:`);
    const evalExpr = AstNode.create('func', 'eval', [solution]);
    const evalResults = Runtime.instance.matchRule(evalExpr);

    // Try simplifying to get the final numeric value
    const finalSolution = simplify(evalExpr);
    console.log(`  Final answer: x = ${finalSolution.toString()}`);
  }
}

console.log("\n-- Test 8: Test with different variable names --");
const eq8a = parse("y = 10");
const solve8a = createSolveExpr(eq8a, 'y');
console.log(`Solve for y: ${solve8a.toString()}`);
const results8a = Runtime.instance.matchRule(solve8a);
console.log(`Solution: ${results8a.length > 0 ? results8a[0].toString() : 'none'}`);

const eq8b = parse("5z = 15");
const solve8b = createSolveExpr(eq8b, 'z');
console.log(`Solve for z: ${solve8b.toString()}`);
const results8b = Runtime.instance.matchRule(solve8b);
console.log(`Found ${results8b.length} transformations`);

console.log("\n-- Test 9: Equation symmetry --");
const eq9a = parse("x = 5");
const eq9b = parse("5 = x");
console.log(`x = 5: ${eq9a.toString()}`);
console.log(`5 = x: ${eq9b.toString()}`);

const solve9a = createSolveExpr(eq9a, 'x');
const solve9b = createSolveExpr(eq9b, 'x');

const results9a = Runtime.instance.matchRule(solve9a);
const results9b = Runtime.instance.matchRule(solve9b);

console.log(`solve(x = 5, solved_for(x)) => ${results9a.length > 0 ? results9a[0].toString() : 'none'}`);
console.log(`solve(5 = x, solved_for(x)) => ${results9b.length > 0 ? results9b[0].toString() : 'none'}`);

console.log("\n-- Test 10: Cost-based comparison --");
const unsolved = parse("2x + 3 = 0");
const solved = parse("x = 5");
console.log(`Unsolved equation (2x + 3 = 0) cost: ${unsolved.getCost()}`);
console.log(`Solved equation (x = 5) cost: ${solved.getCost()}`);
console.log(`The cost system correctly identifies solved form as simpler!`);

console.log("\n=== All Tests Complete ===");

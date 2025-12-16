import { parse } from "./parser.js";
import { AstNode, ASymbol } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";
import { simplify } from "./search.js";

console.log("=== Complete Equation Solving Workflow ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

/**
 * Helper to create a solve expression from an equation string
 */
function solveEquation(equationStr: string, varName: string): AstNode {
  // Parse the equation
  const equation = parse(equationStr);

  // Wrap in solve with solved_for goal
  const solveExpr = AstNode.create('func', 'solve', [
    equation,
    AstNode.create('func', 'solved_for', [
      AstNode.create('symbol', new ASymbol(varName))
    ])
  ]);

  return solveExpr;
}

/**
 * Attempt to solve and evaluate an equation completely
 */
function solveAndEvaluate(equationStr: string, varName: string): void {
  console.log(`\nSolving: ${equationStr} for ${varName}`);
  console.log("=".repeat(60));

  // Step 1: Parse and create solve expression
  const solveExpr = solveEquation(equationStr, varName);
  console.log(`Step 1 - Solve expression:`);
  console.log(`  ${solveExpr.toString()}`);
  console.log(`  Cost: ${solveExpr.getCost()}`);

  // Step 2: Try to simplify using the search algorithm
  console.log(`\nStep 2 - Simplify to find solution:`);
  const simplified = simplify(solveExpr);
  console.log(`  ${simplified.toString()}`);
  console.log(`  Cost: ${simplified.getCost()}`);

  // Step 3: If result is an expression, try to evaluate it
  if (simplified.kind === 'func') {
    console.log(`\nStep 3 - Evaluate the result:`);
    const evalExpr = AstNode.create('func', 'eval', [simplified]);
    const evaluated = simplify(evalExpr);
    console.log(`  ${evaluated.toString()}`);
    console.log(`  Cost: ${evaluated.getCost()}`);

    if (evaluated.kind === 'number') {
      console.log(`\n✓ Final answer: ${varName} = ${evaluated.value}`);
    } else {
      console.log(`\n⚠ Result is still symbolic: ${varName} = ${evaluated.toString()}`);
    }
  } else if (simplified.kind === 'number') {
    console.log(`\n✓ Final answer: ${varName} = ${simplified.value}`);
  } else {
    console.log(`\n⚠ Result: ${varName} = ${simplified.toString()}`);
  }
}

// Test cases demonstrating the complete workflow

console.log("=".repeat(80));
console.log("EXAMPLE 1: Simple equation already in solved form");
solveAndEvaluate("x = 5", "x");

console.log("\n" + "=".repeat(80));
console.log("EXAMPLE 2: Simple equation with swapped sides");
solveAndEvaluate("5 = x", "x");

console.log("\n" + "=".repeat(80));
console.log("EXAMPLE 3: Linear equation in standard form");
solveAndEvaluate("2x + 3 = 0", "x");

console.log("\n" + "=".repeat(80));
console.log("EXAMPLE 4: Linear equation not in standard form");
solveAndEvaluate("2x + 3 = 7", "x");

console.log("\n" + "=".repeat(80));
console.log("EXAMPLE 5: Coefficient multiplication");
solveAndEvaluate("3x = 12", "x");

console.log("\n" + "=".repeat(80));
console.log("EXAMPLE 6: Different variable name");
solveAndEvaluate("y = 42", "y");

console.log("\n" + "=".repeat(80));
console.log("EXAMPLE 7: Negative coefficient");
solveAndEvaluate("2x + 6 = 0", "x");

console.log("\n" + "=".repeat(80));
console.log("\nKEY INSIGHTS:");
console.log("─".repeat(60));
console.log("1. Equations already in solved form (x = value) are directly solved");
console.log("2. Equations in standard form (ax + b = 0) can be solved by linear rule");
console.log("3. Other equations are first normalized to standard form");
console.log("4. The cost function guides the search toward simpler forms");
console.log("5. Results may need evaluation (eval) to get numeric values");

console.log("\n" + "=".repeat(80));
console.log("=== Workflow Complete ===");

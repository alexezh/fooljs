import { AstNode } from "../ast.js";
import { astMatch, astReplace } from "../ast_match.js";
import { parse } from "../parser.js";
import { ruleCalcMul, ruleCalcDiv } from "../rules/mul.js";
import { ruleCommutative, ruleCalcNeg, ruleCalcSum } from "../rules/sum.js";
import { ruleEqSymmetry } from "../rules/corerules.js";

/**
 * Test astMatch + astReplace by comparing with existing rule implementations
 */

function testRule(
  name: string,
  rulePattern: string,
  ruleReplacement: string,
  input: string,
  expectedOutput: string | undefined
) {
  console.log(`\nTest: ${name}`);
  console.log(`  Pattern: ${rulePattern}`);
  console.log(`  Replacement: ${ruleReplacement}`);
  console.log(`  Input: ${input}`);

  const patternAst = parse(rulePattern);
  const replacementAst = parse(ruleReplacement);
  const inputAst = parse(input);

  const bindings = astMatch(patternAst, inputAst);

  if (bindings === undefined) {
    if (expectedOutput === undefined) {
      console.log(`  ✓ No match (as expected)`);
      return true;
    } else {
      console.log(`  ✗ Expected match but got none`);
      return false;
    }
  }

  if (expectedOutput === undefined) {
    console.log(`  ✗ Expected no match but got bindings:`, bindings);
    return false;
  }

  const result = astReplace(replacementAst, bindings);
  const resultStr = result.toString();
  const expectedAst = parse(expectedOutput);
  const expectedStr = expectedAst.toString();

  console.log(`  Bindings:`, Array.from(bindings.entries()).map(([k, v]) => `${k}: ${v.toString()}`));
  console.log(`  Result: ${resultStr}`);
  console.log(`  Expected: ${expectedStr}`);

  if (resultStr === expectedStr) {
    console.log(`  ✓ Match!`);
    return true;
  } else {
    console.log(`  ✗ Mismatch!`);
    return false;
  }
}

function testRuleAgainstExisting(
  name: string,
  rulePattern: string,
  ruleReplacement: string,
  input: string,
  existingRuleFn: (ast: AstNode) => any,
  shouldEvaluate: boolean = false  // If true, existing rule evaluates the result
) {
  console.log(`\nTest against existing: ${name}`);
  console.log(`  Pattern: ${rulePattern}`);
  console.log(`  Replacement: ${ruleReplacement}`);
  console.log(`  Input: ${input}`);

  const patternAst = parse(rulePattern);
  const replacementAst = parse(ruleReplacement);
  const inputAst = parse(input);

  // Test with astMatch + astReplace
  const bindings = astMatch(patternAst, inputAst);

  // Test with existing rule
  const existingResult = existingRuleFn(inputAst);

  if (bindings === undefined && existingResult === undefined) {
    console.log(`  ✓ Both return no match`);
    return true;
  }

  if (bindings === undefined) {
    console.log(`  ✗ astMatch returned no match, but existing rule returned:`, existingResult);
    return false;
  }

  if (existingResult === undefined) {
    console.log(`  ✗ astMatch matched, but existing rule returned no match`);
    return false;
  }

  const result = astReplace(replacementAst, bindings);
  const resultStr = result.toString();
  const existingStr = existingResult.replace.toString();

  console.log(`  astMatch+Replace result: ${resultStr}`);
  console.log(`  Existing rule result: ${existingStr}`);

  if (shouldEvaluate) {
    // For calc_* rules, they evaluate to a number, so just check that astReplace produces the calc_* call
    const expectedPattern = replacementAst.value; // e.g., "calc_mul"
    if (result.kind === 'func' && result.value === expectedPattern) {
      console.log(`  ✓ Produces correct calc function (existing rule evaluates it)`);
      return true;
    } else {
      console.log(`  ✗ Doesn't produce expected calc function`);
      return false;
    }
  }

  if (resultStr === existingStr) {
    console.log(`  ✓ Results match!`);
    return true;
  } else {
    console.log(`  ✗ Results differ!`);
    return false;
  }
}

// Run tests
let passed = 0;
let failed = 0;

function runTest(testFn: () => boolean) {
  try {
    if (testFn()) {
      passed++;
    } else {
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ Exception:`, e);
    failed++;
  }
}

console.log("=== Basic Pattern Matching Tests ===");

runTest(() => testRule(
  "Simple pattern variable",
  "?x",
  "mul(?x, 2)",
  "5",
  "mul(5, 2)"
));

runTest(() => testRule(
  "Function with two args",
  "sum(?a, ?b)",
  "mul(?a, ?b)",
  "sum(3, 4)",
  "mul(3, 4)"
));

runTest(() => testRule(
  "Spread pattern",
  "sum(?first, ?rest...)",
  "mul(?first, sum(?rest...))",
  "sum(2, 3, 4, 5)",
  "mul(2, sum(3, 4, 5))"
));

runTest(() => testRule(
  "Empty spread",
  "sum(?x, ?rest...)",
  "mul(?x, sum(?rest...))",
  "sum(7)",
  "mul(7, sum())"
));

runTest(() => testRule(
  "Equation",
  "eq(?lhs, ?rhs)",
  "eq(?rhs, ?lhs)",
  "eq(x, 5)",
  "eq(5, x)"
));

runTest(() => testRule(
  "Multiple occurrences",
  "sum(?x, ?x)",
  "mul(2, ?x)",
  "sum(3, 3)",
  "mul(2, 3)"
));

runTest(() => testRule(
  "Multiple occurrences - no match",
  "sum(?x, ?x)",
  "mul(2, ?x)",
  "sum(3, 4)",
  undefined
));

console.log("\n=== Tests Against Existing Rules ===");

runTest(() => testRuleAgainstExisting(
  "ruleCalcMul - produces calc_mul call",
  "mul(?a, ?b)",
  "calc_mul(?a, ?b)",
  "mul(3, 4)",
  ruleCalcMul,
  true  // calc rules evaluate to numbers
));

runTest(() => testRuleAgainstExisting(
  "ruleCalcDiv - produces calc_div call",
  "div(?a, ?b)",
  "calc_div(?a, ?b)",
  "div(12, 3)",
  ruleCalcDiv,
  true  // calc rules evaluate to numbers
));

runTest(() => testRuleAgainstExisting(
  "ruleCalcSum - produces calc_sum call",
  "sum(?a, ?b)",
  "calc_sum(?a, ?b)",
  "sum(5, 7)",
  ruleCalcSum,
  true  // calc rules evaluate to numbers
));

runTest(() => testRuleAgainstExisting(
  "ruleCalcNeg - produces calc_neg call",
  "neg(?a)",
  "calc_neg(?a)",
  "neg(5)",
  ruleCalcNeg,
  true  // calc rules evaluate to numbers
));

runTest(() => testRuleAgainstExisting(
  "ruleCommutative - exactly 2 args",
  "sum(?a, ?b)",
  "sum(?b, ?a)",
  "sum(x, y)",
  ruleCommutative
));

runTest(() => testRuleAgainstExisting(
  "ruleEqSymmetry",
  "eq(?a, ?b)",
  "eq(?b, ?a)",
  "eq(x, 5)",
  ruleEqSymmetry
));

console.log("\n=== Advanced Tests ===");

runTest(() => testRule(
  "Nested spread",
  "sum(?a, ?rest...)",
  "sum(?rest..., ?a)",
  "sum(1, 2, 3, 4)",
  "sum(2, 3, 4, 1)"
));

runTest(() => testRule(
  "Spread at beginning",
  "sum(?prefix..., ?last)",
  "sum(?last, ?prefix...)",
  "sum(1, 2, 3)",
  "sum(3, 1, 2)"
));

runTest(() => testRule(
  "Multiple spreads in replacement",
  "sum(?a, ?b, ?rest...)",
  "sum(?rest..., ?a, ?rest..., ?b)",
  "sum(1, 2, 3, 4)",
  "sum(3, 4, 1, 3, 4, 2)"
));

runTest(() => testRule(
  "Equation with spread",
  "eq(sum(?terms...), ?rhs)",
  "eq(?rhs, sum(?terms...))",
  "eq(sum(x, y, z), 0)",
  "eq(0, sum(x, y, z))"
));

console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed === 0) {
  console.log(`\n✓ All tests passed!`);
} else {
  console.log(`\n✗ Some tests failed`);
  process.exit(1);
}

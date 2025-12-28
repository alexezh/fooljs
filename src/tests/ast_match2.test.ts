import { astCreateMatcher } from "../ast_match2.js";
import { matcherSymbols } from "../matchersymbols.js";
import { parse } from "../parser.js";
import { RuleNode } from "../runtime.js";
import { AstNode } from "../ast.js";

function testRule(rule: string, expr: string, shouldMatch: boolean, testName: string): boolean {
  let ruleAst = parse(rule);
  let node: RuleNode = {
    rule: ruleAst,
    pattern: ruleAst.children![0],
    match: ruleAst.children![1],
    where: ruleAst.where,
    matchFunc: undefined!
  }

  let func = astCreateMatcher(node);
  let exprAst = parse(expr);
  let result: AstNode | undefined = func(matcherSymbols, exprAst);

  const matched = result !== undefined;

  if (matched === shouldMatch) {
    console.log(`✓ ${testName}`);
    return true;
  } else {
    console.log(`✗ ${testName}`);
    console.log(`  Expected: ${shouldMatch ? 'match' : 'no match'}`);
    console.log(`  Got: ${matched ? 'match' : 'no match'}`);
    if (result) {
      console.log(`  Result: ${result.toString()}`);
    }
    console.log(`  Generated function: ${func.toString()}`);
    return false;
  }
}

export function testMatcherCodegen(): void {
  console.log("=== Testing Matcher Code Generation ===\n");

  let passed = 0;
  let failed = 0;

  // =========================================================================
  // Basic function calls - positive matches
  // =========================================================================
  console.log("--- Basic Function Calls (Positive Matches) ---");

  if (!testOnly()) {
    if (testRule(
      "sum(?a, ?b) => sum(?b, ?a)",
      "sum(1, 2)",
      true,
      "Basic sum match"
    )) passed++; else failed++;

    if (testRule(
      "mul(?x, ?y) => mul(?y, ?x)",
      "mul(x, 5)",
      true,
      "Function with symbols"
    )) passed++; else failed++;

    if (testRule(
      "neg(?a) => calc_neg(?a)",
      "neg(7)",
      true,
      "Single argument function"
    )) passed++; else failed++;

    if (testRule(
      "div(?a, ?b) => calc_div(?a, ?b)",
      "div(10, 2)",
      true,
      "Division function"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Basic function calls - negative matches
    // =========================================================================
    console.log("--- Basic Function Calls (Negative Matches) ---");

    if (testRule(
      "sum(?a, ?b) => sum(?b, ?a)",
      "mul(1, 2)",
      false,
      "Wrong function name"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => sum(?b, ?a)",
      "sum(1, 2, 3)",
      false,
      "Wrong argument count"
    )) passed++; else failed++;

    if (testRule(
      "neg(?a) => calc_neg(?a)",
      "sum(1, 2)",
      false,
      "Different function signature"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Spread patterns - positive matches
    // =========================================================================
    console.log("--- Spread Patterns (Positive Matches) ---");

    if (testRule(
      "sum(?a, ?rest...) => sum(?a, ?rest...)",
      "sum(1, 2, 3, 4)",
      true,
      "Spread at end"
    )) passed++; else failed++;

    if (testRule(
      "sum(?first..., ?last) => sum(?last, ?first...)",
      "sum(1, 2, 3)",
      true,
      "Spread at beginning"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?mid..., ?b) => sum(?a, ?b, ?mid...)",
      "sum(1, 2, 3, 4)",
      true,
      "Spread in middle"
    )) passed++; else failed++;

    if (testRule(
      "sum(?args...) => mul(?args...)",
      "sum(1, 2, 3)",
      true,
      "Spread all arguments"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Spread patterns - negative matches
    // =========================================================================
    console.log("--- Spread Patterns (Negative Matches) ---");

    if (testRule(
      "sum(?a, ?b, ?rest...) => sum(?rest...)",
      "sum(1)",
      false,
      "Too few arguments for spread"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Where clauses - type checking
    // =========================================================================
    console.log("--- Where Clauses (Type Checking) ---");

    if (testRule(
      "sum(?a, ?b) => calc_sum(?a, ?b) where[is_number(?a), is_number(?b)]",
      "sum(1, 2)",
      true,
      "Type check: both numbers (match)"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => calc_sum(?a, ?b) where[is_number(?a), is_number(?b)]",
      "sum(x, 2)",
      false,
      "Type check: first is symbol (no match)"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => calc_sum(?a, ?b) where[is_number(?a), is_number(?b)]",
      "sum(1, y)",
      false,
      "Type check: second is symbol (no match)"
    )) passed++; else failed++;

    if (testRule(
      "neg(?x) => calc_neg(?x) where[is_number(?x)]",
      "neg(5)",
      true,
      "Single type check (match)"
    )) passed++; else failed++;

    if (testRule(
      "neg(?x) => calc_neg(?x) where[is_number(?x)]",
      "neg(x)",
      false,
      "Single type check (no match)"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Where clauses - comparison
    // =========================================================================
    console.log("--- Where Clauses (Comparison) ---");

    if (testRule(
      "sqrt(?a) => calc_sqrt(?a) where[gte(?a, 0)]",
      "sqrt(4)",
      true,
      "Comparison: gte with positive number (match)"
    )) passed++; else failed++;

    if (testRule(
      "sqrt(?a) => calc_sqrt(?a) where[gte(?a, 0)]",
      "sqrt(0)",
      true,
      "Comparison: gte with zero (match)"
    )) passed++; else failed++;

    if (testRule(
      "log(?a) => calc_ln(?a) where[gt(?a, 0)]",
      "log(5)",
      true,
      "Comparison: gt with positive (match)"
    )) passed++; else failed++;

    if (testRule(
      "log(?a) => calc_ln(?a) where[gt(?a, 0)]",
      "log(0)",
      false,
      "Comparison: gt with zero (no match)"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Where clauses - logical operators
    // =========================================================================
    console.log("--- Where Clauses (Logical Operators) ---");

    if (testRule(
      "sum(?a, ?b) => result(?a, ?b) where[or(is_number(?a), is_number(?b))]",
      "sum(1, x)",
      true,
      "Logical: or - first is number (match)"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => result(?a, ?b) where[or(is_number(?a), is_number(?b))]",
      "sum(x, 2)",
      true,
      "Logical: or - second is number (match)"
    )) passed++; else failed++;


    if (testRule(
      "sum(?a, ?b) => result(?a, ?b) where[or(is_number(?a), is_number(?b))]",
      "sum(x, y)",
      false,
      "Logical: or - neither is number (no match)"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => result(?a, ?b) where[and(is_number(?a), is_number(?b))]",
      "sum(1, 2)",
      true,
      "Logical: and - both numbers (match)"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => result(?a, ?b) where[and(is_number(?a), is_number(?b))]",
      "sum(1, x)",
      false,
      "Logical: and - only one number (no match)"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Where clauses - complex constraints
    // =========================================================================
    console.log("--- Where Clauses (Complex Constraints) ---");

    if (testRule(
      "sum(?a, ?b) => calc_sum(?a, ?b) where[is_number(?a), is_number(?b), gt(?a, ?b)]",
      "sum(5, 3)",
      true,
      "Multiple constraints: all satisfied (match)"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => calc_sum(?a, ?b) where[is_number(?a), is_number(?b), gt(?a, ?b)]",
      "sum(3, 5)",
      false,
      "Multiple constraints: comparison fails (no match)"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?b) => calc_sum(?a, ?b) where[is_number(?a), is_number(?b), gt(?a, ?b)]",
      "sum(x, 3)",
      false,
      "Multiple constraints: type check fails (no match)"
    )) passed++; else failed++;

    console.log();

    // =========================================================================
    // Where clauses - bind and GCD factor
    // =========================================================================
    console.log("--- Where Clauses (Bind and GCD Factor) ---");

    if (testRule(
      'sum(?terms...) => mul(?f, sum(?quot...)) where[?f := gcd_factor([?terms...]), nontrivial_factor(?f), all_divisible_by([?terms...], ?f), [?quot...] := map_div([?terms...], ?f)]',
      "sum(2, 4, 6)",
      true,
      "GCD factorization: 2+4+6 = 2*(1+2+3)"
    )) passed++; else failed++;

    if (testRule(
      'sum(?terms...) => mul(?f, sum(?quot...)) where[?f := gcd_factor([?terms...]), nontrivial_factor(?f), all_divisible_by([?terms...], ?f), [?quot...] := map_div([?terms...], ?f)]',
      "sum(3, 6, 9)",
      true,
      "GCD factorization: 3+6+9 = 3*(1+2+3)"
    )) passed++; else failed++;

    if (testRule(
      'sum(?terms...) => mul(?f, sum(?quot...)) where[?f := gcd_factor([?terms...]), nontrivial_factor(?f), all_divisible_by([?terms...], ?f), [?quot...] := map_div([?terms...], ?f)]',
      "sum(1, 2, 3)",
      false,
      "GCD factorization fails: gcd=1 is trivial"
    )) passed++; else failed++;

    if (testRule(
      'sum(?terms...) => mul(?f, sum(?quot...)) where[?f := gcd_factor([?terms...]), nontrivial_factor(?f), all_divisible_by([?terms...], ?f), [?quot...] := map_div([?terms...], ?f)]',
      "sum(1, 2, 3)",
      false,
      "GCD factorization fails: gcd=1 is trivial"
    )) passed++; else failed++;


    if (testRule(
      "solve(eq(sum(mul(?x, ?a), ?c), 0), solved_for(?x)) => div(neg(?c), ?a) where[is_symbol(?x)]",
      "sum(1, 2, 3)",
      false,
      "GCD factorization fails: gcd=1 is trivial"
    )) passed++; else failed++;

    if (testRule(
      "sum(?a, ?rest...) => mul(?n, ?a) where[ all_eq([?a, ?rest...], ?a), ?n := count([?a, ?rest...]) ]",
      "sum(1, 1, 1)",
      true,
      "sum multiple numbers"
    )) passed++; else failed++;

    // =========================================================================
    // Fold patterns
    // =========================================================================
    console.log("--- Fold Patterns ---");

    // Base case: empty list
    if (testRule(
      "fold(?f, ?acc, []) => ?acc",
      "fold(sum, 0, [])",
      true,
      "Fold base case: empty list returns accumulator"
    )) passed++; else failed++;

    if (testRule(
      "fold(?f, ?acc, []) => ?acc",
      "fold(sum, 0, [1])",
      false,
      "Fold base case: non-empty list fails match"
    )) passed++; else failed++;


    // Recursive case: list with elements
    if (testRule(
      "fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])",
      "fold(sum, 0, [1])",
      true,
      "Fold recursive case: single element list"
    )) passed++; else failed++;

    if (testRule(
      "fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])",
      "fold(sum, 0, [1, 2, 3])",
      true,
      "Fold recursive case: multiple element list"
    )) passed++; else failed++;

    if (testRule(
      "fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])",
      "fold(mul, 1, [x, y, z])",
      true,
      "Fold recursive case: symbols in list"
    )) passed++; else failed++;

    // Negative test: base case should not match non-empty list
    if (testRule(
      "fold(?f, ?acc, []) => ?acc",
      "fold(sum, 0, [1, 2])",
      false,
      "Fold base case: should not match non-empty list"
    )) passed++; else failed++;

    // Negative test: recursive case should not match empty list
    if (testRule(
      "fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])",
      "fold(sum, 0, [])",
      false,
      "Fold recursive case: should not match empty list"
    )) passed++; else failed++;

    // Negative test: wrong number of arguments
    if (testRule(
      "fold(?f, ?acc, []) => ?acc",
      "fold(sum, 0)",
      false,
      "Fold: should not match when missing list argument"
    )) passed++; else failed++;

    // Negative test: third argument not a list
    if (testRule(
      "fold(?f, ?acc, []) => ?acc",
      "fold(sum, 0, 1)",
      false,
      "Fold: should not match when third arg is not a list"
    )) passed++; else failed++;

    if (testRule(
      "fold(?f, ?acc, [?x, ?xs...]) => fold(?f, ?f(?acc, ?x), [?xs...])",
      "fold(sum, 0, 1)",
      false,
      "Fold recursive: should not match when third arg is not a list"
    )) passed++; else failed++;
  }

  if (testRule(
    "div(?a, 1) => ?a",
    "div(x, 1)",
    true,
    "Match divide by 1"
  )) passed++; else failed++;

  if (testRule(
    "div(?a, 1) => ?a",
    "div(x, 2)",
    false,
    "Match divide by 1"
  )) passed++; else failed++;

  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("=== Summary ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
}

function testOnly(): boolean { return true; }

// Run tests if this module is executed directly
testMatcherCodegen();
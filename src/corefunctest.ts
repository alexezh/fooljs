import { parse } from "./parser.js";
import { coreRuleFunctions } from "./corefunc.js";

let testCount = 0;
let passCount = 0;
let failCount = 0;

function testRuleFunction(inputSrc: string, expectedOutput: string | null, ruleFuncIndex: number): void {
  testCount++;
  try {
    const input = parse(inputSrc);
    const ruleFunc = coreRuleFunctions[ruleFuncIndex];
    const result = ruleFunc(input);

    if (expectedOutput === null) {
      // Expect undefined
      if (result === undefined) {
        passCount++;
        console.log(`✓ Test ${testCount}: Rule ${ruleFuncIndex} on "${inputSrc}" => undefined`);
      } else {
        failCount++;
        console.log(`✗ Test ${testCount}: Rule ${ruleFuncIndex} on "${inputSrc}"`);
        console.log(`  Expected: undefined`);
        console.log(`  Actual:   ${result.toString()}`);
      }
    } else {
      // Expect specific output
      if (result === undefined) {
        failCount++;
        console.log(`✗ Test ${testCount}: Rule ${ruleFuncIndex} on "${inputSrc}"`);
        console.log(`  Expected: ${expectedOutput}`);
        console.log(`  Actual:   undefined`);
      } else {
        const actual = result.toString();
        if (actual === expectedOutput) {
          passCount++;
          console.log(`✓ Test ${testCount}: Rule ${ruleFuncIndex} on "${inputSrc}" => ${actual}`);
        } else {
          failCount++;
          console.log(`✗ Test ${testCount}: Rule ${ruleFuncIndex} on "${inputSrc}"`);
          console.log(`  Expected: ${expectedOutput}`);
          console.log(`  Actual:   ${actual}`);
        }
      }
    }
  } catch (error: any) {
    failCount++;
    console.log(`✗ Test ${testCount}: Rule ${ruleFuncIndex} on "${inputSrc}"`);
    console.log(`  Error: ${error.message}`);
  }
}

function corefunctest(): void {
  console.log("=== Core Rule Function Tests ===\n");

  // Rule 0: ruleAssocLeft - sum(?a, ?b, ?c) => sum(add(?a, ?b), ?c)
  console.log("-- Rule 0: Associativity Left --");
  testRuleFunction("sum(1, 2, 3)", "sum(add(1,2),3)", 0);
  testRuleFunction("sum(x, y, z)", "sum(add(x,y),z)", 0);
  testRuleFunction("sum(1, 2)", null, 0);  // Wrong number of args
  testRuleFunction("add(1, 2, 3)", null, 0);  // Wrong function

  // Rule 1: ruleAssocMid - sum(?a, ?b, ?c) => sum(add(?a, ?c), ?b)
  console.log("\n-- Rule 1: Associativity Middle --");
  testRuleFunction("sum(1, 2, 3)", "sum(add(1,3),2)", 1);
  testRuleFunction("sum(x, y, z)", "sum(add(x,z),y)", 1);

  // Rule 2: ruleCommutative - sum(?a, ?b) => sum(?b, ?a)
  console.log("\n-- Rule 2: Commutativity --");
  testRuleFunction("sum(1, 2)", "sum(2,1)", 2);
  testRuleFunction("sum(x, y)", "sum(y,x)", 2);
  testRuleFunction("sum(1, 2, 3)", null, 2);  // Wrong number of args

  // Rule 3: ruleNeutralRight - sum(?a, 0) => ?a
  console.log("\n-- Rule 3: Neutral Element Right --");
  testRuleFunction("sum(5, 0)", "5", 3);
  testRuleFunction("sum(x, 0)", "x", 3);
  testRuleFunction("sum(5, 1)", null, 3);  // Not 0
  testRuleFunction("sum(0, 5)", null, 3);  // Wrong position

  // Rule 4: ruleNeutralLeft - sum(0, ?a) => ?a
  console.log("\n-- Rule 4: Neutral Element Left --");
  testRuleFunction("sum(0, 5)", "5", 4);
  testRuleFunction("sum(0, y)", "y", 4);
  testRuleFunction("sum(1, 5)", null, 4);  // Not 0
  testRuleFunction("sum(5, 0)", null, 4);  // Wrong position

  // Rule 5: ruleLiftSum - currently returns undefined (needs fresh symbol generation)
  console.log("\n-- Rule 5: Lift Sum (not implemented) --");
  testRuleFunction("sum(1, 2)", null, 5);

  // Rule 6: ruleEvalNumber - eval(?n) => ?n where ?n is number
  console.log("\n-- Rule 6: Eval Number --");
  testRuleFunction("eval(42)", "42", 6);
  testRuleFunction("eval(0)", "0", 6);
  testRuleFunction("eval(x)", null, 6);  // Not a number
  testRuleFunction("eval(sum(1,2))", null, 6);  // Not a number

  // Rule 7: ruleEvalSymbol - eval(sym(?x)) => sym(?x) where ?x is symbol_name
  console.log("\n-- Rule 7: Eval Symbol --");
  testRuleFunction("eval(sym(x))", "sym(x)", 7);
  testRuleFunction("eval(sym(foo))", "sym(foo)", 7);
  testRuleFunction("eval(x)", null, 7);  // Not sym(...)
  testRuleFunction("eval(sym(42))", null, 7);  // Not a symbol

  // Rule 8: ruleEvalProgressive - eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...))
  console.log("\n-- Rule 8: Eval Progressive --");
  testRuleFunction("eval(sum(1, 2))", "eval(sum(eval(1),2))", 8);
  testRuleFunction("eval(add(x, y, z))", "eval(add(eval(x),y,z))", 8);
  testRuleFunction("eval(f())", null, 8);  // No args
  testRuleFunction("eval(42)", null, 8);  // Not a function

  // Rule 9: ruleEvalDef - eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e))
  console.log("\n-- Rule 9: Eval Def --");
  testRuleFunction("eval(def(sym(x), 5))", "def(sym(x),eval(5))", 9);
  testRuleFunction("eval(def(sym(y), sum(1,2)))", "def(sym(y),eval(sum(1,2)))", 9);
  testRuleFunction("eval(def(x, 5))", null, 9);  // Not sym(...)
  testRuleFunction("eval(def(sym(42), 5))", null, 9);  // Not a symbol

  // Rule 10: ruleEvalDefSimplify - eval(def(sym(?y), ?e)) => eval(?e)
  console.log("\n-- Rule 10: Eval Def Simplify --");
  testRuleFunction("eval(def(sym(x), 5))", "eval(5)", 10);
  testRuleFunction("eval(def(sym(y), sum(1,2)))", "eval(sum(1,2))", 10);
  testRuleFunction("eval(def(x, 5))", null, 10);  // Not sym(...)

  // Rule 11: ruleMulAssocLeft - mul(?a, ?b, ?c) => mul(prod(?a, ?b), ?c)
  console.log("\n-- Rule 11: Multiply Associativity Left --");
  testRuleFunction("mul(2, 3, 4)", "mul(prod(2,3),4)", 11);
  testRuleFunction("mul(x, y, z)", "mul(prod(x,y),z)", 11);
  testRuleFunction("mul(2, 3)", null, 11);  // Wrong number of args

  // Rule 12: ruleMulCommutative - mul(?a, ?b) => mul(?b, ?a)
  console.log("\n-- Rule 12: Multiply Commutativity --");
  testRuleFunction("mul(2, 3)", "mul(3,2)", 12);
  testRuleFunction("mul(x, y)", "mul(y,x)", 12);

  // Rule 13: ruleMulNeutralRight - mul(?a, 1) => ?a
  console.log("\n-- Rule 13: Multiply Neutral Element Right --");
  testRuleFunction("mul(5, 1)", "5", 13);
  testRuleFunction("mul(x, 1)", "x", 13);
  testRuleFunction("mul(5, 2)", null, 13);  // Not 1

  // Rule 14: ruleMulNeutralLeft - mul(1, ?a) => ?a
  console.log("\n-- Rule 14: Multiply Neutral Element Left --");
  testRuleFunction("mul(1, 5)", "5", 14);
  testRuleFunction("mul(1, y)", "y", 14);

  // Rule 15: ruleMulZeroRight - mul(?a, 0) => 0
  console.log("\n-- Rule 15: Multiply Zero Right --");
  testRuleFunction("mul(5, 0)", "0", 15);
  testRuleFunction("mul(x, 0)", "0", 15);

  // Rule 16: ruleMulZeroLeft - mul(0, ?a) => 0
  console.log("\n-- Rule 16: Multiply Zero Left --");
  testRuleFunction("mul(0, 5)", "0", 16);
  testRuleFunction("mul(0, y)", "0", 16);

  // Rule 17: ruleDivNeutralRight - div(?a, 1) => ?a
  console.log("\n-- Rule 17: Divide Neutral Element Right --");
  testRuleFunction("div(10, 1)", "10", 17);
  testRuleFunction("div(x, 1)", "x", 17);
  testRuleFunction("div(10, 2)", null, 17);  // Not 1

  // Rule 18: ruleDivSelfToOne - div(?a, ?a) => 1
  console.log("\n-- Rule 18: Divide Self to One --");
  testRuleFunction("div(5, 5)", "1", 18);
  testRuleFunction("div(x, x)", "1", 18);
  testRuleFunction("div(5, 3)", null, 18);  // Not equal
  testRuleFunction("div(0, 0)", null, 18);  // Division by zero check

  // Rule 19: ruleParenRemove - paren(?a) => ?a
  console.log("\n-- Rule 19: Parenthesis Remove --");
  testRuleFunction("paren(5)", "5", 19);
  testRuleFunction("paren(x)", "x", 19);
  testRuleFunction("paren(sum(1,2))", "sum(1,2)", 19);

  // Rule 20: ruleSumToMul - sum(?a, ?rest...) => mul(count([?a, ?rest...]), ?a)
  console.log("\n-- Rule 20: Sum to Multiply Conversion --");
  testRuleFunction("sum(5, 5)", "mul(2,5)", 20);
  testRuleFunction("sum(3, 3, 3)", "mul(3,3)", 20);
  testRuleFunction("sum(7, 7, 7, 7, 7)", "mul(5,7)", 20);
  testRuleFunction("sum(5, 6)", null, 20);  // Not equal
  testRuleFunction("sum(x, x)", null, 20);  // Not numbers

  // Rule 21: ruleMulToSum - mul(?n, ?a) => sum(?a, ?a, ...)
  console.log("\n-- Rule 21: Multiply to Sum Expansion --");
  testRuleFunction("mul(2, x)", "sum(x,x)", 21);
  testRuleFunction("mul(3, y)", "sum(y,y,y)", 21);
  testRuleFunction("mul(5, z)", "sum(z,z,z,z,z)", 21);
  testRuleFunction("mul(1, x)", null, 21);  // Count < 2
  testRuleFunction("mul(11, x)", null, 21);  // Count > 10
  testRuleFunction("mul(x, 5)", null, 21);  // First arg not number

  // Summary
  console.log("\n=== Test Summary ===");
  console.log(`Total:  ${testCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

corefunctest();

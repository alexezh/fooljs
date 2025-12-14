import { parse } from "./parser.js";
import { coreRuleFunctions } from "./rules/ruletable.js";

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

  // Rule 0: ruleAssocLeft - sum(?a, ?b, ?rest...) => sum(sum(?a, ?b), ?rest...)
  console.log("-- Rule 0: Associativity Left (3+ args) --");
  testRuleFunction("sum(1, 2, 3)", "sum(sum(1,2),3)", 0);
  testRuleFunction("sum(x, y, z)", "sum(sum(x,y),z)", 0);
  testRuleFunction("sum(1, 2, 3, 4)", "sum(sum(1,2),3,4)", 0);  // Works with 4+ args
  testRuleFunction("sum(1, 2)", null, 0);  // Need at least 3 args
  testRuleFunction("add(1, 2, 3)", null, 0);  // Wrong function

  // Rule 1: ruleAssocMid - sum(?a, ?b, ?c) => sum(sum(?a, ?c), ?b)
  console.log("\n-- Rule 1: Associativity Middle --");
  testRuleFunction("sum(1, 2, 3)", "sum(sum(1,3),2)", 1);
  testRuleFunction("sum(x, y, z)", "sum(sum(x,z),y)", 1);

  // Rule 2: ruleCommutative - sum(?a, ?b) => sum(?b, ?a)
  console.log("\n-- Rule 2: Commutativity --");
  testRuleFunction("sum(1, 2)", "sum(2,1)", 2);
  testRuleFunction("sum(x, y)", "sum(y,x)", 2);
  testRuleFunction("sum(1, 2, 3)", null, 2);  // Wrong number of args

  // Rule 3: ruleSwapEnds - sum(?a, ?mid..., ?c) => sum(?c, ?mid..., ?a)
  console.log("\n-- Rule 3: Swap First and Last --");
  testRuleFunction("sum(1, 2)", "sum(2,1)", 3);
  testRuleFunction("sum(1, 2, 3)", "sum(3,2,1)", 3);
  testRuleFunction("sum(a, b, c, d)", "sum(d,b,c,a)", 3);

  // Rule 4: ruleNeutralRight - sum(?args..., 0, ?rest...) => sum(?args..., ?rest...)
  console.log("\n-- Rule 4: Neutral Element (Remove Zeros) --");
  testRuleFunction("sum(5, 0)", "5", 4);
  testRuleFunction("sum(x, 0)", "x", 4);
  testRuleFunction("sum(0, 5)", "5", 4);  // Now works anywhere
  testRuleFunction("sum(1, 2, 0, 3)", "sum(1,2,3)", 4);  // Removes zero from middle
  testRuleFunction("sum(5, 1)", null, 4);  // Not 0

  // Rule 6: ruleLiftSum - currently returns undefined (needs fresh symbol generation)
  console.log("\n-- Rule 6: Lift Sum (not implemented) --");
  testRuleFunction("sum(1, 2)", null, 6);

  // Rule 7: ruleEvalNumber - eval(?n) => ?n where ?n is number
  console.log("\n-- Rule 7: Eval Number --");
  testRuleFunction("eval(42)", "42", 7);
  testRuleFunction("eval(0)", "0", 7);
  testRuleFunction("eval(x)", null, 7);  // Not a number
  testRuleFunction("eval(sum(1,2))", null, 7);  // Not a number

  // Rule 8: ruleEvalSymbol - eval(sym(?x)) => sym(?x) where ?x is symbol_name
  console.log("\n-- Rule 8: Eval Symbol --");
  testRuleFunction("eval(sym(x))", "sym(x)", 8);
  testRuleFunction("eval(sym(foo))", "sym(foo)", 8);
  testRuleFunction("eval(x)", null, 8);  // Not sym(...)
  testRuleFunction("eval(sym(42))", null, 8);  // Not a symbol

  // Rule 9: ruleEvalProgressive - eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...))
  console.log("\n-- Rule 9: Eval Progressive --");
  testRuleFunction("eval(sum(1, 2))", "eval(sum(eval(1),2))", 9);
  testRuleFunction("eval(add(x, y, z))", "eval(add(eval(x),y,z))", 9);
  testRuleFunction("eval(f())", null, 9);  // No args
  testRuleFunction("eval(42)", null, 9);  // Not a function

  // Rule 10: ruleEvalDef - eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e))
  console.log("\n-- Rule 10: Eval Def --");
  testRuleFunction("eval(def(sym(x), 5))", "def(sym(x),eval(5))", 10);
  testRuleFunction("eval(def(sym(y), sum(1,2)))", "def(sym(y),eval(sum(1,2)))", 10);
  testRuleFunction("eval(def(x, 5))", null, 10);  // Not sym(...)
  testRuleFunction("eval(def(sym(42), 5))", null, 10);  // Not a symbol

  // Rule 11: ruleEvalDefSimplify - eval(def(sym(?y), ?e)) => eval(?e)
  console.log("\n-- Rule 11: Eval Def Simplify --");
  testRuleFunction("eval(def(sym(x), 5))", "eval(5)", 11);
  testRuleFunction("eval(def(sym(y), sum(1,2)))", "eval(sum(1,2))", 11);
  testRuleFunction("eval(def(x, 5))", null, 11);  // Not sym(...)

  // Rule 12: ruleEvalSum - eval(sum(?a, ?b)) => calc_sum(?a, ?b) where ?a is number, ?b is number
  console.log("\n-- Rule 12: Eval Sum --");
  testRuleFunction("eval(sum(2, 3))", "5", 12);
  testRuleFunction("eval(sum(10, 5))", "15", 12);
  testRuleFunction("eval(sum(x, 5))", null, 12);  // Not both numbers

  // Rule 13: ruleEvalMul - eval(mul(?a, ?b)) => calc_mul(?a, ?b) where ?a is number, ?b is number
  console.log("\n-- Rule 13: Eval Mul --");
  testRuleFunction("eval(mul(2, 3))", "6", 13);
  testRuleFunction("eval(mul(4, 7))", "28", 13);
  testRuleFunction("eval(mul(x, 5))", null, 13);  // Not both numbers

  // Rule 14: ruleEvalDiv - eval(div(?a, ?b)) => calc_div(?a, ?b) where ?a is number, ?b is number
  console.log("\n-- Rule 14: Eval Div --");
  testRuleFunction("eval(div(10, 2))", "5", 14);
  testRuleFunction("eval(div(15, 3))", "5", 14);
  testRuleFunction("eval(div(10, 0))", null, 14);  // Division by zero
  testRuleFunction("eval(div(x, 5))", null, 14);  // Not both numbers

  // Rule 15: ruleEvalNeg - eval(neg(?a)) => calc_neg(?a) where ?a is number
  console.log("\n-- Rule 15: Eval Neg --");
  testRuleFunction("eval(neg(5))", "-5", 15);
  testRuleFunction("eval(neg(0))", "0", 15);
  testRuleFunction("eval(neg(x))", null, 15);  // Not a number

  // Rule 16: ruleMulAssocLeft - mul(?a, ?b, ?rest...) => mul(mul(?a, ?b), ?rest...)
  console.log("\n-- Rule 16: Multiply Associativity Left (3+ args) --");
  testRuleFunction("mul(2, 3, 4)", "mul(mul(2,3),4)", 16);
  testRuleFunction("mul(x, y, z)", "mul(mul(x,y),z)", 16);
  testRuleFunction("mul(2, 3, 4, 5)", "mul(mul(2,3),4,5)", 16);  // Works with 4+ args
  testRuleFunction("mul(2, 3)", null, 16);  // Need at least 3 args

  // Rule 17: ruleMulCommutative - mul(?a, ?b) => mul(?b, ?a)
  console.log("\n-- Rule 17: Multiply Commutativity --");
  testRuleFunction("mul(2, 3)", "mul(3,2)", 17);
  testRuleFunction("mul(x, y)", "mul(y,x)", 17);

  // Rule 18: ruleMulNeutralRight - mul(?args..., 1, ?rest...) => mul(?args..., ?rest...)
  console.log("\n-- Rule 18: Multiply Neutral Element (Remove Ones) --");
  testRuleFunction("mul(5, 1)", "5", 18);
  testRuleFunction("mul(x, 1)", "x", 18);
  testRuleFunction("mul(1, 5)", "5", 18);  // Now works anywhere
  testRuleFunction("mul(2, 3, 1, 4)", "mul(2,3,4)", 18);  // Removes one from middle
  testRuleFunction("mul(5, 2)", null, 18);  // Not 1

  // Rule 19: ruleMulNeutralLeft - same as ruleMulNeutralRight (deprecated)
  console.log("\n-- Rule 19: Multiply Neutral Element Left (same as Right) --");
  testRuleFunction("mul(1, 5)", "5", 19);
  testRuleFunction("mul(1, y)", "y", 19);
  testRuleFunction("mul(5, 1)", "5", 19);  // Now works anywhere

  // Rule 20: ruleMulZeroRight - mul(?args..., 0, ?rest...) => 0
  console.log("\n-- Rule 20: Multiply Zero (Any Zero Makes Zero) --");
  testRuleFunction("mul(5, 0)", "0", 20);
  testRuleFunction("mul(x, 0)", "0", 20);
  testRuleFunction("mul(0, 5)", "0", 20);  // Works anywhere
  testRuleFunction("mul(2, 3, 0, 4)", "0", 20);  // Zero anywhere makes product zero

  // Rule 21: ruleMulZeroLeft - same as ruleMulZeroRight (deprecated)
  console.log("\n-- Rule 21: Multiply Zero Left (same as Right) --");
  testRuleFunction("mul(0, 5)", "0", 21);
  testRuleFunction("mul(0, y)", "0", 21);
  testRuleFunction("mul(5, 0)", "0", 21);  // Works anywhere

  // Rule 22: ruleDivNeutralRight - div(?a, 1) => ?a
  console.log("\n-- Rule 22: Divide Neutral Element Right --");
  testRuleFunction("div(10, 1)", "10", 22);
  testRuleFunction("div(x, 1)", "x", 22);
  testRuleFunction("div(10, 2)", null, 22);  // Not 1

  // Rule 23: ruleDivSelfToOne - div(?a, ?a) => 1
  console.log("\n-- Rule 23: Divide Self to One --");
  testRuleFunction("div(5, 5)", "1", 23);
  testRuleFunction("div(x, x)", "1", 23);
  testRuleFunction("div(5, 3)", null, 23);  // Not equal
  testRuleFunction("div(0, 0)", null, 23);  // Division by zero check

  // Rule 24: ruleParenRemove - paren(?a) => ?a
  console.log("\n-- Rule 24: Parenthesis Remove --");
  testRuleFunction("paren(5)", "5", 24);
  testRuleFunction("paren(x)", "x", 24);
  testRuleFunction("paren(sum(1,2))", "sum(1,2)", 24);

  // Rule 25: ruleSubToSum - sub(?a, ?b) => sum(?a, neg(?b))
  console.log("\n-- Rule 25: Subtraction to Sum --");
  testRuleFunction("sub(5, 3)", "sum(5,neg(3))", 25);
  testRuleFunction("sub(x, y)", "sum(x,neg(y))", 25);

  // Rule 26: ruleDoubleNeg - neg(neg(?a)) => ?a
  console.log("\n-- Rule 26: Double Negation Elimination --");
  testRuleFunction("neg(neg(5))", "5", 26);
  testRuleFunction("neg(neg(x))", "x", 26);

  // Rule 27: ruleNegZero - neg(0) => 0
  console.log("\n-- Rule 27: Negation of Zero --");
  testRuleFunction("neg(0)", "0", 27);
  testRuleFunction("neg(5)", null, 27);

  // Rule 28: ruleSumNegSelf - sum(?a, neg(?a)) => 0
  console.log("\n-- Rule 28: Sum with Negation --");
  testRuleFunction("sum(x, neg(x))", "0", 28);
  testRuleFunction("sum(5, neg(5))", "0", 28);

  // Rule 29: ruleSumToMul - sum(?a, ?rest...) => mul(count([?a, ?rest...]), ?a)
  console.log("\n-- Rule 29: Sum to Multiply Conversion --");
  testRuleFunction("sum(5, 5)", "mul(2,5)", 29);
  testRuleFunction("sum(3, 3, 3)", "mul(3,3)", 29);
  testRuleFunction("sum(7, 7, 7, 7, 7)", "mul(5,7)", 29);
  testRuleFunction("sum(5, 6)", null, 29);  // Not equal
  testRuleFunction("sum(x, x)", null, 29);  // Not numbers

  // Rule 30: ruleMulToSum - mul(?n, ?a) => sum(?a, ?a, ...)
  console.log("\n-- Rule 30: Multiply to Sum Expansion --");
  testRuleFunction("mul(2, x)", "sum(x,x)", 30);
  testRuleFunction("mul(3, y)", "sum(y,y,y)", 30);
  testRuleFunction("mul(5, z)", "sum(z,z,z,z,z)", 30);
  testRuleFunction("mul(1, x)", null, 30);  // Count < 2
  testRuleFunction("mul(11, x)", null, 30);  // Count > 10
  testRuleFunction("mul(x, 5)", null, 30);  // First arg not number

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

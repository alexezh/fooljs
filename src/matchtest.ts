import { Runtime } from "./runtime.js";
import { parse } from "./parser.js";
import { initCore } from "./corefunc.js";

let testCount = 0;
let passCount = 0;
let failCount = 0;

function testMatch(ruleSrc: string, inputSrc: string, expectedOutputs: string[]): void {
  testCount++;
  try {
    const runtime = new Runtime();
    runtime.addRule(ruleSrc);

    const input = parse(inputSrc);
    const results = runtime.matchRule(input);

    // Convert results to strings for comparison
    const actualOutputs = results.map(r => r.toString()).sort();
    const sortedExpected = [...expectedOutputs].sort();

    if (actualOutputs.length !== sortedExpected.length) {
      failCount++;
      console.log(`✗ Test ${testCount}: "${inputSrc}" against rule "${ruleSrc}"`);
      console.log(`  Expected ${sortedExpected.length} matches, got ${actualOutputs.length}`);
      console.log(`  Expected: [${sortedExpected.join(', ')}]`);
      console.log(`  Actual:   [${actualOutputs.join(', ')}]`);
      return;
    }

    let allMatch = true;
    for (let i = 0; i < actualOutputs.length; i++) {
      if (actualOutputs[i] !== sortedExpected[i]) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      passCount++;
      console.log(`✓ Test ${testCount}: "${inputSrc}" => [${actualOutputs.join(', ')}]`);
    } else {
      failCount++;
      console.log(`✗ Test ${testCount}: "${inputSrc}" against rule "${ruleSrc}"`);
      console.log(`  Expected: [${sortedExpected.join(', ')}]`);
      console.log(`  Actual:   [${actualOutputs.join(', ')}]`);
    }
  } catch (error: any) {
    failCount++;
    console.log(`✗ Test ${testCount}: "${inputSrc}" against rule "${ruleSrc}"`);
    console.log(`  Error: ${error.message}`);
  }
}

function testCoreRules(inputSrc: string, expectedOutputs: string[]): void {
  testCount++;
  try {
    const runtime = new Runtime();
    initCore(runtime);

    const input = parse(inputSrc);
    const results = runtime.matchRule(input);

    // Convert results to strings for comparison
    const actualOutputs = results.map(r => r.toString()).sort();
    const sortedExpected = [...expectedOutputs].sort();

    if (actualOutputs.length !== sortedExpected.length) {
      failCount++;
      console.log(`✗ Test ${testCount}: core rules for "${inputSrc}"`);
      console.log(`  Expected ${sortedExpected.length} matches, got ${actualOutputs.length}`);
      console.log(`  Expected: [${sortedExpected.join(', ')}]`);
      console.log(`  Actual:   [${actualOutputs.join(', ')}]`);
      return;
    }

    let allMatch = true;
    for (let i = 0; i < actualOutputs.length; i++) {
      if (actualOutputs[i] !== sortedExpected[i]) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      passCount++;
      console.log(`✓ Test ${testCount}: core rules for "${inputSrc}" => ${actualOutputs.length} matches`);
    } else {
      failCount++;
      console.log(`✗ Test ${testCount}: core rules for "${inputSrc}"`);
      console.log(`  Expected: [${sortedExpected.join(', ')}]`);
      console.log(`  Actual:   [${actualOutputs.join(', ')}]`);
    }
  } catch (error: any) {
    failCount++;
    console.log(`✗ Test ${testCount}: core rules for "${inputSrc}"`);
    console.log(`  Error: ${error.message}`);
  }
}

function matchtest(): void {
  console.log("=== Match Tests ===\n");

  // Basic pattern matching
  console.log("-- Basic Pattern Matching --");
  testMatch("?x => ?x", "42", ["42"]);
  testMatch("?x => ?x", "foo", ["foo"]);
  testMatch("?a => ?b", "123", ["?b"]);

  // Number matching
  console.log("\n-- Number Matching --");
  testMatch("42 => 100", "42", ["100"]);
  testMatch("42 => 100", "43", []);
  testMatch("?x => 100 where ?x is number", "42", ["100"]);
  testMatch("?x => 100 where ?x is number", "foo", []);

  // Symbol matching
  console.log("\n-- Symbol Matching --");
  testMatch("x => y", "x", ["y"]);
  testMatch("x => y", "z", []);
  testMatch("a1 => b2", "a1", ["b{2}"]);
  testMatch("a{?x} => b{?x}", "a{5}", ["b{5}"]);

  // Function call matching
  console.log("\n-- Function Call Matching --");
  testMatch("sum(?a, ?b) => add(?a, ?b)", "sum(1, 2)", ["add(1,2)"]);
  testMatch("sum(?a, ?b) => add(?a, ?b)", "sum(x, y)", ["add(x,y)"]);
  testMatch("sum(?a, ?b) => add(?a, ?b)", "mul(1, 2)", []);
  testMatch("mul(?a, ?b) => prod(?a, ?b)", "mul(3, 4)", ["prod(3,4)"]);

  // Constraint checking
  console.log("\n-- Constraint Checking --");
  testMatch("sum(?a, ?b) => add(?a, ?b) where ?a is number", "sum(5, x)", ["add(5,x)"]);
  testMatch("sum(?a, ?b) => add(?a, ?b) where ?a is number", "sum(x, 5)", []);
  testMatch("sum(?a, ?b) => add(?a, ?b) where ?a is number, ?b is number", "sum(1, 2)", ["add(1,2)"]);
  testMatch("sum(?a, ?b) => add(?a, ?b) where ?a is number, ?b is number", "sum(1, x)", []);

  // Variable binding consistency
  console.log("\n-- Variable Binding Consistency --");
  testMatch("sum(?x, ?x) => double(?x)", "sum(5, 5)", ["double(5)"]);
  testMatch("sum(?x, ?x) => double(?x)", "sum(5, 6)", []);
  testMatch("sum(?x, ?x) => double(?x)", "sum(a, a)", ["double(a)"]);

  // Commutativity rule
  console.log("\n-- Commutativity --");
  testMatch("sum(?a, ?b) => sum(?b, ?a)", "sum(1, 2)", ["sum(2,1)"]);
  testMatch("sum(?a, ?b) => sum(?b, ?a)", "sum(x, y)", ["sum(y,x)"]);

  // Neutral element
  console.log("\n-- Neutral Element --");
  testMatch("sum(?a, 0) => ?a", "sum(5, 0)", ["5"]);
  testMatch("sum(?a, 0) => ?a", "sum(x, 0)", ["x"]);
  testMatch("sum(?a, 0) => ?a", "sum(5, 1)", []);
  testMatch("sum(0, ?a) => ?a", "sum(0, 42)", ["42"]);

  // Spread operators
  console.log("\n-- Spread Operators --");
  testMatch("?f(?a, ?rest...) => ?f(eval(?a), ?rest...)", "sum(1, 2, 3)", ["sum(eval(1),2,3)"]);
  testMatch("?f(?a, ?rest...) => ?f(eval(?a), ?rest...)", "add(x, y, z)", ["add(eval(x),y,z)"]);
  testMatch("eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name",
            "eval(sum(1, 2))", ["eval(sum(eval(1),2))"]);

  // Multiple argument spread
  console.log("\n-- Multiple Argument Spread --");
  testMatch("sum(?a, ?b, ?c) => sum(add(?a, ?b), ?c)", "sum(1, 2, 3)", ["sum(add(1,2),3)"]);
  testMatch("sum(?a, ?b, ?c) => sum(?a, add(?b, ?c))", "sum(1, 2, 3)", ["sum(1,add(2,3))"]);

  // Pattern variable in function position
  console.log("\n-- Pattern Variable as Function Name --");
  testMatch("?f(?x) => wrapped(?f, ?x) where ?f is func_name", "eval(5)", ["wrapped(eval,5)"]);
  testMatch("?f(?x) => wrapped(?f, ?x) where ?f is func_name", "sym(x)", ["wrapped(sym,x)"]);

  // Core rules tests
  console.log("\n-- Core Rules from corefunc.ts --");
  testCoreRules("sum(1, 2)", ["sum(2,1)"]);
  testCoreRules("sum(x, 0)", ["x", "sum(0,x)"]);  // Matches neutral element AND commutativity
  testCoreRules("sum(0, y)", ["y", "sum(y,0)"]);  // Matches neutral element AND commutativity
  testCoreRules("sum(1, 2, 3)", ["sum(add(1,2),3)", "sum(add(1,3),2)"]);
  testCoreRules("eval(5)", ["5"]);
  testCoreRules("eval(sym(x))", ["sym(x)", "eval(sym(eval(x)))"]);

  // Summary
  console.log("\n=== Test Summary ===");
  console.log(`Total:  ${testCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

matchtest();

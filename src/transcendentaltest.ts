import { parse } from "./parser.js";
import { AstNode } from "./ast.js";
import { Runtime } from "./runtime.js";
import { initCore } from "./rules/ruletable.js";
import { simplify } from "./search.js";

console.log("=== Transcendental Functions Tests ===\n");

// Initialize runtime with core rules
initCore(Runtime.instance);

// Helper to test evaluation
function testEval(exprStr: string, description: string): void {
  console.log(`-- ${description} --`);
  const expr = parse(exprStr);
  console.log(`Input:  ${expr.toString()}`);

  const evalExpr = AstNode.create('func', 'eval', [expr]);
  console.log(`Eval:   ${evalExpr.toString()}`);

  const result = simplify(evalExpr);
  console.log(`Result: ${result.toString()}`);
  console.log();
}

console.log("=".repeat(80));
console.log("POW TESTS");
console.log("=".repeat(80));
console.log();

testEval("pow(2, 3)", "Test 1: pow(2, 3) should equal 8");
testEval("pow(5, 2)", "Test 2: pow(5, 2) should equal 25");
testEval("pow(10, 0)", "Test 3: pow(10, 0) should equal 1");
testEval("pow(7, 1)", "Test 4: pow(7, 1) should equal 7");
testEval("pow(1, 100)", "Test 5: pow(1, 100) should equal 1");
testEval("pow(0, 5)", "Test 6: pow(0, 5) should equal 0");
testEval("pow(2, -1)", "Test 7: pow(2, -1) should equal 0.5");

console.log("=".repeat(80));
console.log("SQRT TESTS");
console.log("=".repeat(80));
console.log();

testEval("sqrt(4)", "Test 8: sqrt(4) should equal 2");
testEval("sqrt(9)", "Test 9: sqrt(9) should equal 3");
testEval("sqrt(16)", "Test 10: sqrt(16) should equal 4");
testEval("sqrt(2)", "Test 11: sqrt(2) should equal ~1.414");
testEval("sqrt(0)", "Test 12: sqrt(0) should equal 0");

console.log("=".repeat(80));
console.log("LOG TESTS");
console.log("=".repeat(80));
console.log();

testEval("log(1)", "Test 13: log(1) should equal 0");

console.log("=".repeat(80));
console.log("EXP TESTS");
console.log("=".repeat(80));
console.log();

testEval("exp(0)", "Test 14: exp(0) should equal 1");
testEval("exp(1)", "Test 15: exp(1) should equal e (~2.718)");
testEval("exp(2)", "Test 16: exp(2) should equal e^2 (~7.389)");

console.log("=".repeat(80));
console.log("IDENTITY TESTS");
console.log("=".repeat(80));
console.log();

testEval("log(exp(5))", "Test 17: log(exp(5)) should equal 5");
testEval("exp(log(10))", "Test 18: exp(log(10)) should equal 10");

console.log("=".repeat(80));
console.log("COMPOSED TESTS");
console.log("=".repeat(80));
console.log();

testEval("pow(sqrt(4), 2)", "Test 19: pow(sqrt(4), 2) should equal 4");
testEval("sqrt(pow(3, 2))", "Test 20: sqrt(pow(3, 2)) should equal 3");
testEval("sum(pow(2, 3), pow(3, 2))", "Test 21: 2^3 + 3^2 = 8 + 9 = 17");

console.log("=== All Tests Complete ===");

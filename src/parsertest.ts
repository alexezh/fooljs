import { parse } from "./parser.js";

let testCount = 0;
let passCount = 0;
let failCount = 0;

function validateAst(inp: string, output: string): void {
  testCount++;
  try {
    let ast = parse(inp);
    const actual = ast.toString();
    if (actual === output) {
      passCount++;
      console.log(`✓ Test ${testCount}: "${inp}"`);
    } else {
      failCount++;
      console.log(`✗ Test ${testCount}: "${inp}"`);
      console.log(`  Expected: ${output}`);
      console.log(`  Actual:   ${actual}`);
    }
  } catch (error: any) {
    failCount++;
    console.log(`✗ Test ${testCount}: "${inp}"`);
    console.log(`  Error: ${error.message}`);
  }
}

function parsertest(): void {
  console.log("=== Parser Tests ===\n");

  // Numbers
  console.log("-- Numbers --");
  validateAst("1", "1");
  validateAst("42", "42");
  validateAst("999", "999");

  // Pattern variables
  console.log("\n-- Pattern Variables --");
  validateAst("?v", "?v");
  validateAst("?x", "?x");
  validateAst("?x1", "?x1");
  validateAst("?abc", "?abc");

  // Symbols - plain
  console.log("\n-- Symbols (Plain) --");
  validateAst("x", "x");
  validateAst("foo", "foo");
  validateAst("myVar", "myVar");

  // Symbols - numbered
  console.log("\n-- Symbols (Numbered) --");
  validateAst("a1", "a{1}");
  validateAst("x2", "x{2}");
  validateAst("var99", "var{99}");

  // Symbols - indexed (complex)
  console.log("\n-- Symbols (Indexed) --");
  validateAst("a{x}", "a{x}");
  validateAst("a{1}", "a{1}");
  validateAst("a{x,1}", "a{x,1}");
  validateAst("a{x, 1}", "a{x,1}");  // with spaces
  validateAst("f{1,2,3}", "f{1,2,3}");
  validateAst("a{?v,1}", "a{?v,1}");
  validateAst("a{x,y,z}", "a{x,y,z}");

  // Function calls - simple
  console.log("\n-- Function Calls --");
  validateAst("sum(a,b)", "sum(a,b)");
  validateAst("sum(a, b)", "sum(a,b)");  // with spaces
  validateAst("add(1,2)", "add(1,2)");
  validateAst("mul(?x,?y)", "mul(?x,?y)");
  validateAst("f()", "f()");

  // Function calls - complex arguments
  console.log("\n-- Function Calls (Complex) --");
  validateAst("sum(a1,b2)", "sum(a{1},b{2})");
  validateAst("f(a{x,1},b)", "f(a{x,1},b)");
  validateAst("add(?a,1)", "add(?a,1)");
  validateAst("sum(a,b,c)", "sum(a,b,c)");

  // Rules - simple
  console.log("\n-- Rules (Simple) --");
  validateAst("a => b", "rule(a,b)");
  validateAst("?x => ?y", "rule(?x,?y)");
  validateAst("sum(a,b) => add(a,b)", "rule(sum(a,b),add(a,b))");

  // Rules with where clauses - single constraint
  console.log("\n-- Rules (Where - Single) --");
  validateAst("?x => ?y where ?x is number", "rule(?x,?y)where x is number");
  validateAst("?x => ?y where ?x is var", "rule(?x,?y)where x is var");

  // Rules with where clauses - multiple constraints
  console.log("\n-- Rules (Where - Multiple) --");
  validateAst("sum(?a,?b) => add(?a,?b) where ?a is number, ?b is number",
              "rule(sum(?a,?b),add(?a,?b))where a is number,b is number");
  validateAst("mul(?x,?y) => prod(?x,?y) where ?x is var, ?y is number",
              "rule(mul(?x,?y),prod(?x,?y))where x is var,y is number");
  validateAst("f(?a,?b,?c) => g(?a,?b,?c) where ?a is number, ?b is var, ?c is number",
              "rule(f(?a,?b,?c),g(?a,?b,?c))where a is number,b is var,c is number");

  // Edge cases
  console.log("\n-- Edge Cases --");
  validateAst("0", "0");
  validateAst("a0", "a{0}");
  validateAst("a{}", "a{}");
  validateAst("f(x)", "f(x)");

  // Lists and spread
  console.log("\n-- Lists and Spread --");
  validateAst("[]", "[]");
  validateAst("[?x, ?y]", "[?x,?y]");
  validateAst("(?a, ?x)", "(?a,?x)");
  validateAst("[ (?a, ?x)... ]", "[(?a,?x)...]");
  validateAst("[?x...]", "[?x...]");
  validateAst("?x...", "?x...");
  validateAst("alt_fixed(?a, [?x...])", "alt_fixed(?a,[?x...])");

  // Eval rules and type constraints
  console.log("\n-- Eval Rules --");
  validateAst(
    "eval(?n) => ?n where ?n is number",
    "rule(eval(?n),?n)where n is number"
  );
  validateAst(
    "eval(sym(?x)) => sym(?x) where ?x is symbol_name",
    "rule(eval(sym(?x)),sym(?x))where x is symbol_name"
  );
  validateAst(
    "eval(?f(?a, ?rest...)) => eval(?f(eval(?a), ?rest...)) where ?f is func_name",
    "rule(eval(?f(?a,?rest...)),eval(?f(eval(?a),?rest...)))where f is func_name"
  );
  validateAst(
    "eval(def(sym(?y), ?e)) => def(sym(?y), eval(?e)) where ?y is symbol_name",
    "rule(eval(def(sym(?y),?e)),def(sym(?y),eval(?e)))where y is symbol_name"
  );

  // Summary
  console.log("\n=== Test Summary ===");
  console.log(`Total:  ${testCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

parsertest();

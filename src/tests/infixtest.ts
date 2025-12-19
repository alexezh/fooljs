import { parse } from "../parser.js";
import { initCore } from "../ruletable.js";
import { Runtime } from "../runtime.js";

console.log("=== Infix Expression Parsing Tests ===\n");

// Test 1: Simple arithmetic
console.log("-- Test 1: Simple arithmetic --");
let expr1 = "-4 + 3 * 4 + x + y - 3 + 5y";
let ast1 = parse(expr1);
console.log(`Input:  ${expr1}`);
console.log(`Parsed: ${ast1.toString()}`);
console.log();

// Test 2: Parentheses
console.log("-- Test 2: Parentheses --");
let expr2 = "(x + y) * 2";
let ast2 = parse(expr2);
console.log(`Input:  ${expr2}`);
console.log(`Parsed: ${ast2.toString()}`);
console.log();

// Test 3: Division
console.log("-- Test 3: Division --");
let expr3 = "10 / 2 + 3";
let ast3 = parse(expr3);
console.log(`Input:  ${expr3}`);
console.log(`Parsed: ${ast3.toString()}`);
console.log();

// Test 4: Multiple negations
console.log("-- Test 4: Multiple negations --");
let expr4 = "--5 + 3";
let ast4 = parse(expr4);
console.log(`Input:  ${expr4}`);
console.log(`Parsed: ${ast4.toString()}`);
console.log();

// Test 5: Apply rules
console.log("-- Test 5: Apply rules --");
const runtime = new Runtime();
initCore(runtime);

let expr5 = "x - x";
let ast5 = parse(expr5);
console.log(`Input:  ${expr5}`);
console.log(`Parsed: ${ast5.toString()}`);

const results = runtime.matchRule(ast5);
console.log(`Matches ${results.length} rules:`);
for (const result of results) {
  console.log(`  => ${result.toString()}`);
}
console.log();

// Test 6: Simplification of double negation
console.log("-- Test 6: Simplification --");
let expr6 = "--5";
let ast6 = parse(expr6);
console.log(`Input:  ${expr6}`);
console.log(`Parsed: ${ast6.toString()}`);

const results6 = runtime.matchRule(ast6);
console.log(`Matches ${results6.length} rules:`);
for (const result of results6) {
  console.log(`  => ${result.toString()}`);
}
console.log();

console.log("=== Demonstration Complete ===");

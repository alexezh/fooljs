import { parse } from "../parser.js";

console.log("=== Equation and Power Operator Tests ===\n");

console.log("-- Test 1: Simple power --");
const expr1 = parse("x^2");
console.log(`Input: x^2`);
console.log(`Parsed: ${expr1.toString()}`);
console.log(`Kind: ${expr1.kind}`);

console.log("\n-- Test 2: Power with coefficient --");
const expr2 = parse("3x^2");
console.log(`Input: 3x^2`);
console.log(`Parsed: ${expr2.toString()}`);

console.log("\n-- Test 3: Multiple powers --");
const expr3 = parse("2x^2 + 3x^3");
console.log(`Input: 2x^2 + 3x^3`);
console.log(`Parsed: ${expr3.toString()}`);

console.log("\n-- Test 4: Right-associative power --");
const expr4 = parse("2^3^4");
console.log(`Input: 2^3^4`);
console.log(`Parsed: ${expr4.toString()}`);
console.log(`Note: Should be pow(2, pow(3, 4)) = 2^81, not (2^3)^4 = 4096`);

console.log("\n-- Test 5: Simple equation --");
const expr5 = parse("x = 5");
console.log(`Input: x = 5`);
console.log(`Parsed: ${expr5.toString()}`);
console.log(`Kind: ${expr5.kind}`);

console.log("\n-- Test 6: Equation with expressions --");
const expr6 = parse("x + 1 = 5");
console.log(`Input: x + 1 = 5`);
console.log(`Parsed: ${expr6.toString()}`);

console.log("\n-- Test 7: Complex equation --");
const expr7 = parse("2x^2 + 3x - 5 = 0");
console.log(`Input: 2x^2 + 3x - 5 = 0`);
console.log(`Parsed: ${expr7.toString()}`);

console.log("\n-- Test 8: Original failing example (with standard minus) --");
try {
  const expr8 = parse("7x + 2x^2 - 14 + 3x^2 = x - 2");
  console.log(`Input: 7x + 2x^2 - 14 + 3x^2 = x - 2`);
  console.log(`Parsed: ${expr8.toString()}`);
  console.log(`Kind: ${expr8.kind}`);
  console.log(`Success!`);
} catch (error: any) {
  console.log(`Error: ${error.message}`);
}

console.log("\n-- Test 9: Power takes precedence over multiplication --");
const expr9 = parse("2 * 3^4");
console.log(`Input: 2 * 3^4`);
console.log(`Parsed: ${expr9.toString()}`);
console.log(`Note: Should be mul(2, pow(3, 4)) = 2 * 81 = 162`);

console.log("\n-- Test 10: Power takes precedence over negation --");
const expr10 = parse("-x^2");
console.log(`Input: -x^2`);
console.log(`Parsed: ${expr10.toString()}`);
console.log(`Note: Should be neg(pow(x, 2)) = -(x^2)`);

console.log("\n-- Test 11: Unicode minus variants --");
console.log(`Testing en-dash (U+2013): x – 5`);
const expr11a = parse("x – 5");
console.log(`Parsed: ${expr11a.toString()}`);

console.log(`Testing minus sign (U+2212): x − 5`);
const expr11b = parse("x − 5");
console.log(`Parsed: ${expr11b.toString()}`);

console.log(`Testing original expression with en-dash: 7x + 2x^2 – 14 + 3x^2 = x – 2`);
const expr11c = parse("7x + 2x^2 – 14 + 3x^2 = x – 2");
console.log(`Parsed: ${expr11c.toString()}`);
console.log(`Success! Grammar accepts multiple minus character variants.`);

console.log("\n=== All Tests Complete ===");

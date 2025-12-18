import { parse } from "../parser.js";

console.log("=== Cost Calculation Tests ===\n");

console.log("-- Basic expressions --");
console.log(`5: cost = ${parse("5").getCost()}`);
console.log(`x: cost = ${parse("x").getCost()}`);
console.log(`1 + 2: cost = ${parse("1 + 2").getCost()}`);
console.log(`x + y: cost = ${parse("x + y").getCost()}`);

console.log("\n-- Power expressions --");
console.log(`x^2: cost = ${parse("x^2").getCost()}`);
console.log(`x^10: cost = ${parse("x^10").getCost()}`);
console.log(`x^20: cost = ${parse("x^20").getCost()}`);
console.log(`2^x: cost = ${parse("2^x").getCost()}`);
console.log(`x^(1/2): cost = ${parse("x^(1/2)").getCost()}`);

console.log("\n-- Complex expressions --");
console.log(`3x^2 + 2x + 1: cost = ${parse("3x^2 + 2x + 1").getCost()}`);
console.log(`2x^2 + 3x^3: cost = ${parse("2x^2 + 3x^3").getCost()}`);

console.log("\n-- Equations --");
console.log(`x = 5: cost = ${parse("x = 5").getCost()}`);
console.log(`2x + 3 = 0: cost = ${parse("2x + 3 = 0").getCost()}`);
console.log(`x^2 + 2x + 1 = 0: cost = ${parse("x^2 + 2x + 1 = 0").getCost()}`);

console.log("\n-- Eval expressions --");
console.log(`eval(5): cost = ${parse("eval(5)").getCost()}`);
console.log(`eval(sum(2, 3)): cost = ${parse("eval(sum(2, 3))").getCost()}`);

console.log("\n-- Transcendental functions --");
console.log(`sqrt(x): cost = ${parse("sqrt(x)").getCost()}`);
console.log(`log(x): cost = ${parse("log(x)").getCost()}`);
console.log(`exp(x): cost = ${parse("exp(x)").getCost()}`);

console.log("\n-- Cost comparison (lower is simpler) --");
const expr1 = parse("x + x");
const expr2 = parse("2 * x");
console.log(`x + x: cost = ${expr1.getCost()}`);
console.log(`2 * x: cost = ${expr2.getCost()}`);

const expr3 = parse("x * x");
const expr4 = parse("x^2");
console.log(`x * x: cost = ${expr3.getCost()}`);
console.log(`x^2: cost = ${expr4.getCost()}`);

const expr5 = parse("sum(1, 2, 0, 3)");
const expr6 = parse("sum(1, 2, 3)");
console.log(`sum(1, 2, 0, 3): cost = ${expr5.getCost()}`);
console.log(`sum(1, 2, 3): cost = ${expr6.getCost()}`);

console.log("\n-- Special cases --");
console.log(`x + neg(x): cost = ${parse("sum(x, neg(x))").getCost()} (should have reward for cancellation)`);
console.log(`mul(0, x): cost = ${parse("mul(0, x)").getCost()} (multiply by zero)`);
console.log(`div(x, x): cost = ${parse("div(x, x)").getCost()} (self division)`);

console.log("\n=== Tests Complete ===");

// Test the degree analysis functions

import { Runtime } from "../runtime.js";
import { degreeInX, isLinearInX, isQuadraticInX } from "../degree.js";

console.log("======================================================================");
console.log("DEGREE ANALYSIS TESTS");
console.log("======================================================================\n");

const runtime = new Runtime();

// Test: degree of linear expressions
console.log("=== Linear Expressions ===\n");

const lin1 = runtime.parseExpr("x");
console.log("deg_x(x) =", degreeInX(lin1, "x"), "(expected: 1)");

const lin2 = runtime.parseExpr("mul(3, x)");
console.log("deg_x(3x) =", degreeInX(lin2, "x"), "(expected: 1)");

const lin3 = runtime.parseExpr("sum(x, 2)");
console.log("deg_x(x + 2) =", degreeInX(lin3, "x"), "(expected: 1)");

const lin4 = runtime.parseExpr("sum(mul(3, x), 5)");
console.log("deg_x(3x + 5) =", degreeInX(lin4, "x"), "(expected: 1)");

const lin5 = runtime.parseExpr("sum(x, y)");
console.log("deg_x(x + y) =", degreeInX(lin5, "x"), "(expected: 1)");
console.log("deg_y(x + y) =", degreeInX(lin5, "y"), "(expected: 1)");

// Test: degree of quadratic expressions
console.log("\n=== Quadratic Expressions ===\n");

const quad1 = runtime.parseExpr("pow(x, 2)");
console.log("deg_x(x²) =", degreeInX(quad1, "x"), "(expected: 2)");

const quad2 = runtime.parseExpr("sum(pow(x, 2), mul(3, x), 5)");
console.log("deg_x(x² + 3x + 5) =", degreeInX(quad2, "x"), "(expected: 2)");

const quad3 = runtime.parseExpr("mul(x, x)");
console.log("deg_x(x * x) =", degreeInX(quad3, "x"), "(expected: 2)");

// Test: degree of constant expressions
console.log("\n=== Constant Expressions ===\n");

const const1 = runtime.parseExpr("5");
console.log("deg_x(5) =", degreeInX(const1, "x"), "(expected: 0)");

const const2 = runtime.parseExpr("y");
console.log("deg_x(y) =", degreeInX(const2, "x"), "(expected: 0)");

const const3 = runtime.parseExpr("sum(3, 7)");
console.log("deg_x(3 + 7) =", degreeInX(const3, "x"), "(expected: 0)");

// Test: non-polynomial expressions
console.log("\n=== Non-Polynomial Expressions ===\n");

const nonpoly1 = runtime.parseExpr("pow(x, y)");
console.log("deg_x(x^y) =", degreeInX(nonpoly1, "x"), "(expected: null - variable exponent)");

const nonpoly2 = runtime.parseExpr("div(x, y)");
console.log("deg_x(x / y) =", degreeInX(nonpoly2, "x"), "(expected: 1 - y is constant w.r.t. x)");
console.log("deg_y(x / y) =", degreeInX(nonpoly2, "y"), "(expected: null - y in denominator)");

// Test: helper functions
console.log("\n=== Helper Functions ===\n");

console.log("isLinearInX(x) =", isLinearInX(lin1, "x"), "(expected: true)");
console.log("isLinearInX(3x + 5) =", isLinearInX(lin4, "x"), "(expected: true)");
console.log("isLinearInX(x²) =", isLinearInX(quad1, "x"), "(expected: false)");
console.log("isLinearInX(5) =", isLinearInX(const1, "x"), "(expected: false - constant, not linear)");

console.log("\nisQuadraticInX(x²) =", isQuadraticInX(quad1, "x"), "(expected: true)");
console.log("isQuadraticInX(x² + 3x + 5) =", isQuadraticInX(quad2, "x"), "(expected: true)");
console.log("isQuadraticInX(x) =", isQuadraticInX(lin1, "x"), "(expected: false)");

console.log("\n======================================================================");
console.log("ALL DEGREE TESTS COMPLETED");
console.log("======================================================================");

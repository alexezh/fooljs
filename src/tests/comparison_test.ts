import { gt, gte, lt, lte } from "../constraintfuncs.js";
import { AstNode } from "../ast.js";

console.log("=== Testing Comparison Constraint Functions ===\n");

// Test gt (greater than)
console.log("Test gt (greater than):");
console.log("  gt(5, 3):", gt([AstNode.create('number', 5), AstNode.create('number', 3)])?.toString(), "expected: 1");
console.log("  gt(3, 5):", gt([AstNode.create('number', 3), AstNode.create('number', 5)])?.toString(), "expected: 0");
console.log("  gt(5, 5):", gt([AstNode.create('number', 5), AstNode.create('number', 5)])?.toString(), "expected: 0");
console.log();

// Test gte (greater than or equal)
console.log("Test gte (greater than or equal):");
console.log("  gte(5, 3):", gte([AstNode.create('number', 5), AstNode.create('number', 3)])?.toString(), "expected: 1");
console.log("  gte(3, 5):", gte([AstNode.create('number', 3), AstNode.create('number', 5)])?.toString(), "expected: 0");
console.log("  gte(5, 5):", gte([AstNode.create('number', 5), AstNode.create('number', 5)])?.toString(), "expected: 1");
console.log();

// Test lt (less than)
console.log("Test lt (less than):");
console.log("  lt(3, 5):", lt([AstNode.create('number', 3), AstNode.create('number', 5)])?.toString(), "expected: 1");
console.log("  lt(5, 3):", lt([AstNode.create('number', 5), AstNode.create('number', 3)])?.toString(), "expected: 0");
console.log("  lt(5, 5):", lt([AstNode.create('number', 5), AstNode.create('number', 5)])?.toString(), "expected: 0");
console.log();

// Test lte (less than or equal)
console.log("Test lte (less than or equal):");
console.log("  lte(3, 5):", lte([AstNode.create('number', 3), AstNode.create('number', 5)])?.toString(), "expected: 1");
console.log("  lte(5, 3):", lte([AstNode.create('number', 5), AstNode.create('number', 3)])?.toString(), "expected: 0");
console.log("  lte(5, 5):", lte([AstNode.create('number', 5), AstNode.create('number', 5)])?.toString(), "expected: 1");
console.log();

console.log("=== All comparison tests completed ===");

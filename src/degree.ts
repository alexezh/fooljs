// =============================================================================
// Polynomial degree analysis for expressions
// =============================================================================
//
// This module provides utilities to compute the polynomial degree of an
// expression with respect to a given variable.
//
// Used for semantic guards like "linear in x" (degree 1) or "quadratic in x" (degree 2).

import { AstNode } from "./ast.js";

/**
 * Compute the polynomial degree of an expression with respect to a variable.
 *
 * Returns:
 * - A non-negative integer (0, 1, 2, ...) if the expression is polynomial in x
 * - null if the expression is non-polynomial (e.g., sqrt(x), log(x), sin(x))
 *
 * Rules:
 * - deg_x(constant) = 0
 * - deg_x(x) = 1
 * - deg_x(other_variable) = 0 (treated as parameter)
 * - deg_x(sum(e1, ..., en)) = max(deg_x(e1), ..., deg_x(en))
 * - deg_x(mul(e1, ..., en)) = deg_x(e1) + ... + deg_x(en)
 * - deg_x(pow(x, n)) = n (if n is a constant)
 * - deg_x(pow(other, n)) = 0 (if other doesn't contain x)
 * - deg_x(neg(e)) = deg_x(e)
 * - deg_x(div(e1, e2)) = deg_x(e1) if deg_x(e2) = 0, else null (non-polynomial)
 * - For any other function (sqrt, log, etc.): null if contains x, 0 otherwise
 *
 * @param node - The expression to analyze
 * @param xName - The variable name to compute degree with respect to
 * @returns The degree (0, 1, 2, ...) or null if non-polynomial
 */
export function degreeInX(node: AstNode, xName: string): number | null {
  switch (node.kind) {
    case "number":
      return 0;

    case "symbol": {
      const sym = node.value;
      // Type guard for ASymbol
      if (typeof sym === "object" && sym !== null && "name" in sym) {
        // Check if this is the variable x (with no index)
        if (sym.name === xName && (sym.index == null || sym.index.length === 0)) {
          return 1;
        }
        // Other symbols are treated as parameters/constants
        // TODO: If symbol has index containing x, handle recursively
      }
      return 0;
    }

    case "func": {
      const name = node.value;
      const children = node.children ?? [];

      // sum: degree is max of all terms
      if (name === "sum") {
        let maxDeg = 0;
        for (const ch of children) {
          const d = degreeInX(ch, xName);
          if (d === null) return null; // non-polynomial term
          if (d > maxDeg) maxDeg = d;
        }
        return maxDeg;
      }

      // mul: degree is sum of all factors
      if (name === "mul") {
        let totalDeg = 0;
        for (const ch of children) {
          const d = degreeInX(ch, xName);
          if (d === null) return null; // non-polynomial factor
          totalDeg += d;
        }
        return totalDeg;
      }

      // neg: degree is same as argument
      if (name === "neg") {
        if (children.length !== 1) return null;
        return degreeInX(children[0], xName);
      }

      // pow: special handling for powers
      if (name === "pow") {
        const [base, exp] = children;
        if (!base || !exp) return null;

        const baseDeg = degreeInX(base, xName);
        if (baseDeg === null) return null;

        // If base doesn't contain x, power is just a constant
        if (baseDeg === 0) return 0;

        // If base contains x, exponent must be a constant integer
        if (exp.kind === "number") {
          const expVal = exp.value as number;
          // Check if exponent is a non-negative integer
          if (Number.isInteger(expVal) && expVal >= 0) {
            return baseDeg * expVal;
          }
        }

        // pow(expr_with_x, non_constant) is non-polynomial
        return null;
      }

      // div: division is only polynomial if denominator doesn't contain x
      if (name === "div") {
        const [num, denom] = children;
        if (!num || !denom) return null;

        const numDeg = degreeInX(num, xName);
        if (numDeg === null) return null;

        const denomDeg = degreeInX(denom, xName);
        if (denomDeg === null) return null;

        // Denominator must not contain x for this to be polynomial
        if (denomDeg !== 0) return null;

        return numDeg;
      }

      // For any other function (sqrt, log, sin, cos, etc.):
      // If it contains x, it's non-polynomial
      // If it doesn't contain x, treat as constant
      const hasX = containsVariable(node, xName);
      return hasX ? null : 0;
    }

    default:
      return null;
  }
}

/**
 * Check if an expression contains a given variable.
 *
 * @param node - The expression to check
 * @param xName - The variable name to look for
 * @returns true if x appears anywhere in the expression
 */
export function containsVariable(node: AstNode, xName: string): boolean {
  if (node.kind === "symbol") {
    const sym = node.value;
    // Type guard for ASymbol
    if (typeof sym === "object" && sym !== null && "name" in sym) {
      if (sym.name === xName) return true;
      // Check index if present
      for (const idx of sym.index ?? []) {
        if (containsVariable(idx, xName)) return true;
      }
    }
    return false;
  }

  // Check children
  for (const ch of node.children ?? []) {
    if (containsVariable(ch, xName)) return true;
  }

  return false;
}

/**
 * Check if an expression is linear in a given variable.
 * Returns true if degree is exactly 1.
 *
 * @param node - The expression to check
 * @param xName - The variable name
 * @returns true if expression is linear in x
 */
export function isLinearInX(node: AstNode, xName: string): boolean {
  const deg = degreeInX(node, xName);
  return deg === 1;
}

/**
 * Check if an expression is at most linear in a given variable.
 * Returns true if degree is 0 or 1.
 *
 * @param node - The expression to check
 * @param xName - The variable name
 * @returns true if expression is at most degree 1 in x
 */
export function isAtMostLinearInX(node: AstNode, xName: string): boolean {
  const deg = degreeInX(node, xName);
  return deg !== null && deg <= 1;
}

/**
 * Check if an expression is quadratic in a given variable.
 * Returns true if degree is exactly 2.
 *
 * @param node - The expression to check
 * @param xName - The variable name
 * @returns true if expression is quadratic in x
 */
export function isQuadraticInX(node: AstNode, xName: string): boolean {
  const deg = degreeInX(node, xName);
  return deg === 2;
}

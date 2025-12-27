import { AstNode, astEquals } from "./ast.js";
import { gt, gte, lt, lte, is_symbol_name, is_number, is_func, is_func_name, map_div_by_x, all_divisible_by } from "./constraintfuncs.js";

/**
 * Interface for symbols/functions that can be used in where clauses
 * These are available to generated matcher code
 */
export interface IMatcherSymbols {
  // Logical operators
  or(v1: AstNode, v2: AstNode): boolean;
  and(v1: AstNode, v2: AstNode): boolean;
  not(v: AstNode): boolean;

  // Equality
  eq_ast(v1: AstNode, v2: AstNode): boolean;

  // Type checking
  is_symbol_name(x: AstNode): boolean;
  is_number(x: AstNode): boolean;
  is_func(x: AstNode): boolean;
  is_func_name(x: AstNode): boolean;

  // Comparison
  gt(a: AstNode, b: AstNode): boolean;
  gte(a: AstNode, b: AstNode): boolean;
  lt(a: AstNode, b: AstNode): boolean;
  lte(a: AstNode, b: AstNode): boolean;

  // List/array operations
  map_div_by_x(terms: AstNode, x: AstNode): AstNode | undefined;
  all_divisible_by(terms: AstNode, x: AstNode): boolean;
}

/**
 * Implementation of matcher symbols
 * This class provides all the constraint functions that can be used in where clauses
 */
export class MatcherSymbols implements IMatcherSymbols {
  // Logical operators
  or(v1: AstNode, v2: AstNode): boolean {
    return this.isTruthy(v1) || this.isTruthy(v2);
  }

  and(v1: AstNode, v2: AstNode): boolean {
    return this.isTruthy(v1) && this.isTruthy(v2);
  }

  not(v: AstNode): boolean {
    return !this.isTruthy(v);
  }

  // Equality
  eq_ast(v1: AstNode, v2: AstNode): boolean {
    return astEquals(v1, v2);
  }

  // Type checking
  is_symbol_name(x: AstNode): boolean {
    const result = is_symbol_name([x]);
    return this.isTruthy(result);
  }

  is_number(x: AstNode): boolean {
    const result = is_number([x]);
    return this.isTruthy(result);
  }

  is_func(x: AstNode): boolean {
    const result = is_func([x]);
    return this.isTruthy(result);
  }

  is_func_name(x: AstNode): boolean {
    const result = is_func_name([x]);
    return this.isTruthy(result);
  }

  // Comparison
  gt(a: AstNode, b: AstNode): boolean {
    const result = gt([a, b]);
    return this.isTruthy(result);
  }

  gte(a: AstNode, b: AstNode): boolean {
    const result = gte([a, b]);
    return this.isTruthy(result);
  }

  lt(a: AstNode, b: AstNode): boolean {
    const result = lt([a, b]);
    return this.isTruthy(result);
  }

  lte(a: AstNode, b: AstNode): boolean {
    const result = lte([a, b]);
    return this.isTruthy(result);
  }

  // List/array operations
  map_div_by_x(terms: AstNode, x: AstNode): AstNode | undefined {
    return map_div_by_x([terms, x]);
  }

  all_divisible_by(terms: AstNode, x: AstNode): boolean {
    const result = all_divisible_by([terms, x]);
    return this.isTruthy(result);
  }

  /**
   * Helper to check if an AstNode is truthy
   * - undefined/null = false
   * - number 0 = false
   * - everything else = true
   */
  private isTruthy(node: AstNode | undefined): boolean {
    if (node === undefined || node === null) {
      return false;
    }
    if (node.kind === 'number' && node.value === 0) {
      return false;
    }
    return true;
  }
}

// Export singleton instance for convenience
export const matcherSymbols = new MatcherSymbols();

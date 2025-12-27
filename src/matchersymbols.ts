import { AstNode, astEquals } from "./ast.js";
import { map_div_by_x, all_divisible_by } from "./constraintfuncs.js";

/**
 * Interface for symbols/functions that can be used in where clauses
 * These are available to generated matcher code
 */
export interface IMatcherSymbols {
  // Logical operators
  or(v1: boolean | number | AstNode, v2: boolean | number | AstNode): boolean;
  and(v1: boolean | number | AstNode, v2: boolean | number | AstNode): boolean;
  not(v: boolean | number | AstNode): boolean;

  // Equality
  eq_ast(v1: AstNode, v2: AstNode): boolean;

  // Type checking
  is_symbol_name(x: AstNode): boolean;
  is_number(x: AstNode): boolean;
  is_func(x: AstNode): boolean;
  is_func_name(x: AstNode): boolean;

  // Comparison
  gt(a: AstNode | number, b: AstNode | number): boolean;
  gte(a: AstNode | number, b: AstNode | number): boolean;
  lt(a: AstNode | number, b: AstNode | number): boolean;
  lte(a: AstNode | number, b: AstNode | number): boolean;

  // List/array operations
  map_div_by_x(terms: AstNode, x: AstNode): AstNode | undefined;
  all_divisible_by(terms: AstNode, x: AstNode): boolean;

  // Node creation
  makeNode(kind: string, value: any, children?: AstNode[]): AstNode;
}

/**
 * Implementation of matcher symbols
 * This class provides all the constraint functions that can be used in where clauses
 */
export class MatcherSymbols implements IMatcherSymbols {
  // Logical operators
  or(v1: boolean | number | AstNode, v2: boolean | number | AstNode): boolean {
    return this.toBoolean(v1) || this.toBoolean(v2);
  }

  and(v1: boolean | number | AstNode, v2: boolean | number | AstNode): boolean {
    return this.toBoolean(v1) && this.toBoolean(v2);
  }

  not(v: boolean | number | AstNode): boolean {
    return !this.toBoolean(v);
  }

  // Equality
  eq_ast(v1: AstNode, v2: AstNode): boolean {
    return astEquals(v1, v2);
  }

  // Type checking
  is_symbol_name(x: AstNode): boolean {
    return x.kind === 'symbol';
  }

  is_number(x: AstNode): boolean {
    return x.kind === 'number';
  }

  is_func(x: AstNode): boolean {
    return x.kind === 'func';
  }

  is_func_name(x: AstNode): boolean {
    return x.kind === 'func';
  }

  // Comparison
  gt(a: AstNode | number, b: AstNode | number): boolean {
    const aVal = this.toNumber(a);
    const bVal = this.toNumber(b);
    if (aVal === undefined || bVal === undefined) {
      return false;
    }
    return aVal > bVal;
  }

  gte(a: AstNode | number, b: AstNode | number): boolean {
    const aVal = this.toNumber(a);
    const bVal = this.toNumber(b);
    if (aVal === undefined || bVal === undefined) {
      return false;
    }
    return aVal >= bVal;
  }

  lt(a: AstNode | number, b: AstNode | number): boolean {
    const aVal = this.toNumber(a);
    const bVal = this.toNumber(b);
    if (aVal === undefined || bVal === undefined) {
      return false;
    }
    return aVal < bVal;
  }

  lte(a: AstNode | number, b: AstNode | number): boolean {
    const aVal = this.toNumber(a);
    const bVal = this.toNumber(b);
    if (aVal === undefined || bVal === undefined) {
      return false;
    }
    return aVal <= bVal;
  }

  // List/array operations
  map_div_by_x(terms: AstNode, x: AstNode): AstNode | undefined {
    return map_div_by_x([terms, x]);
  }

  all_divisible_by(terms: AstNode, x: AstNode): boolean {
    const result = all_divisible_by([terms, x]);
    return this.isTruthy(result);
  }

  // Node creation
  makeNode(kind: string, value: any, children?: AstNode[]): AstNode {
    return AstNode.create(kind as any, value, children);
  }

  /**
   * Helper to convert AstNode or number to number
   */
  private toNumber(value: AstNode | number): number | undefined {
    if (typeof value === 'number') {
      return value;
    }
    if (value.kind === 'number') {
      return value.value as number;
    }
    return undefined;
  }

  /**
   * Helper to convert boolean, number, or AstNode to boolean
   * - boolean: return as-is
   * - number: 0 = false, non-zero = true
   * - AstNode: number 0 = false, undefined/null = false, everything else = true
   */
  private toBoolean(value: boolean | number | AstNode): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return this.isTruthy(value);
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

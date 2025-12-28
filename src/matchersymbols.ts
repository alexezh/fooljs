import { AstNode, ASymbol, astEquals } from "./ast.js";

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
  map_div(terms: AstNode, x: AstNode): AstNode[] | undefined;
  all_divisible_by(terms: AstNode, x: AstNode): boolean;
  gcd_factor(terms: AstNode): AstNode | undefined;
  nontrivial_factor(x: AstNode): boolean;

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
  map_div(terms: AstNode, x: AstNode): AstNode[] | undefined {
    let termsList = this.toArray(terms);
    if (!termsList || termsList.length === 0) {
      return undefined;
    }

    const quotients: AstNode[] = [];

    for (const term of termsList) {
      const quotient = this.divideTermBy(term, x);
      if (quotient === undefined) {
        return undefined; // Cannot divide this term by x
      }
      quotients.push(quotient);
    }

    // Return as a list
    return quotients;
  }

  all_divisible_by(terms: AstNode | AstNode[], x: AstNode): boolean {
    let termsList = this.toArray(terms);
    if (!termsList || termsList.length === 0) {
      return false;
    }

    for (const term of termsList) {
      if (this.divideTermBy(term, x) === undefined) {
        return false;
      }
    }

    return true;
  }

  private divideTermBy(term: AstNode, x: AstNode): AstNode | undefined {
    // If x is a number, divide numerically
    if (x.kind === 'number') {
      return this.divideTermByNumber(term, x.value as number);
    }

    // Otherwise, treat x as an AST factor to remove from multiplication
    return this.divideTermByFactor(term, x);
  }

  private divideTermByNumber(term: AstNode, n: number): AstNode | undefined {
    if (n === 0) return undefined; // Can't divide by zero

    // If term is a number, divide it
    if (term.kind === 'number') {
      const result = (term.value as number) / n;
      // Check if it divides evenly
      if (result !== Math.floor(result)) {
        return undefined;
      }
      return AstNode.create('number', result);
    }

    // If term is mul(...), look for a numeric factor
    if (term.kind === 'func' && term.value === 'mul') {
      const factors = term.children || [];
      const numIndex = factors.findIndex(f => f.kind === 'number');

      if (numIndex !== -1) {
        const numFactor = factors[numIndex];
        const result = (numFactor.value as number) / n;

        // Check if it divides evenly
        if (result !== Math.floor(result)) {
          return undefined;
        }

        // Replace the numeric factor with the result
        const newFactors = [...factors];
        if (result === 1) {
          // Remove the factor
          newFactors.splice(numIndex, 1);
        } else {
          newFactors[numIndex] = AstNode.create('number', result);
        }

        if (newFactors.length === 0) {
          return AstNode.create('number', 1);
        } else if (newFactors.length === 1) {
          return newFactors[0];
        } else {
          return AstNode.create('func', 'mul', newFactors);
        }
      }
    }

    return undefined;
  }

  private divideTermByFactor(term: AstNode, x: AstNode): AstNode | undefined {
    // Case 1: term equals x => quotient is 1
    if (astEquals(term, x)) {
      return AstNode.create('number', 1);
    }

    // Case 2: term is mul(...) containing x => remove x from factors
    if (term.kind === 'func' && term.value === 'mul') {
      const factors = term.children || [];

      // Look for x in the factors
      const xIndex = factors.findIndex(f => astEquals(f, x));

      if (xIndex !== -1) {
        // Remove x from factors
        const remaining = factors.filter((_, i) => i !== xIndex);

        if (remaining.length === 0) {
          return AstNode.create('number', 1);
        } else if (remaining.length === 1) {
          return remaining[0];
        } else {
          return AstNode.create('func', 'mul', remaining);
        }
      }
    }

    // Case 3: term doesn't contain x
    return undefined;
  }

  gcd_factor(terms: AstNode | AstNode[]): AstNode | undefined {
    let children = this.toArray(terms);
    if (!children || children.length === 0) {
      return undefined;
    }

    // Extract numeric coefficients from terms
    const coefficients: number[] = [];
    for (const term of children) {
      if (term.kind === 'number') {
        coefficients.push(Math.abs(term.value as number));
      } else if (term.kind === 'func' && term.value === 'mul') {
        // Look for numeric factor in multiplication
        const numChild = term.children?.find(c => c.kind === 'number');
        if (numChild) {
          coefficients.push(Math.abs(numChild.value as number));
        }
      }
    }

    if (coefficients.length === 0) {
      return undefined;
    }

    // Compute GCD of all coefficients
    let gcd = coefficients[0];
    for (let i = 1; i < coefficients.length; i++) {
      gcd = this.gcd(gcd, coefficients[i]);
    }

    return AstNode.create('number', gcd);
  }

  nontrivial_factor(x: AstNode | number): boolean {
    if (typeof (x) === 'number') {
      const value = Math.abs(x as number);
      return value > 1;
    } else {
      if (x.kind !== 'number') {
        return false;
      }
      const value = Math.abs(x.value as number);
      return value > 1;
    }
  }

  private gcd(a: number, b: number): number {
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
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

  private toArray(terms: AstNode | AstNode[]): ReadonlyArray<AstNode> | undefined {
    if (Array.isArray(terms)) {
      return terms;
    } else if (terms.kind !== 'list') {
      return undefined;
    } else {
      return terms.children || [];
    }
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

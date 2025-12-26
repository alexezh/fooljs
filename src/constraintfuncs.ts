import { AstNode, ASymbol } from "./ast.js";

/**
 * Constraint functions are used in where clauses to perform complex checks
 * and transformations. They take AST nodes as arguments and return AST nodes.
 *
 * Example: map_div_by_x([?terms...], ?x) => [?qs...]
 * This divides each term by x and returns the quotients.
 */

export type ConstraintFunction = (args: ReadonlyArray<AstNode>) => AstNode | undefined;

export class ConstraintFunctionRegistry {
  private funcs = new Map<string, ConstraintFunction>();

  register(name: string, func: ConstraintFunction): void {
    this.funcs.set(name, func);
  }

  get(name: string): ConstraintFunction | undefined {
    return this.funcs.get(name);
  }

  has(name: string): boolean {
    return this.funcs.has(name);
  }
}

/**
 * map_div_by_x([terms...], x) => [quotients...]
 *
 * For each term in the list, attempt to divide it by x.
 * Returns a list of quotients if all terms are divisible by x.
 * Returns undefined if any term is not divisible by x.
 *
 * Examples:
 * - map_div_by_x([mul(2, x), mul(3, x)], x) => [2, 3]
 * - map_div_by_x([mul(x, 5), mul(x, 7)], x) => [5, 7]
 * - map_div_by_x([x, mul(2, x)], x) => [1, 2]
 * - map_div_by_x([mul(2, y), mul(3, y)], x) => undefined (terms don't contain x)
 */
export function map_div_by_x(args: AstNode[]): AstNode | undefined {
  if (args.length !== 2) return undefined;

  const termsNode = args[0];
  const xNode = args[1];

  // Extract the list of terms
  let terms: ReadonlyArray<AstNode>;
  if (termsNode.kind === 'list') {
    terms = termsNode.children || [];
  } else {
    return undefined;
  }

  // Extract the variable name
  const x = xNode.kind === 'symbol' ? (xNode.value as ASymbol).name :
    xNode.kind === 'patvar' ? xNode.value as string :
      undefined;
  if (!x) return undefined;

  const quotients: AstNode[] = [];

  for (const term of terms) {
    const quotient = divideTermByX(term, x);
    if (quotient === undefined) {
      return undefined; // Cannot divide this term by x
    }
    quotients.push(quotient);
  }

  // Return as a list
  return AstNode.create('list', 'list', quotients);
}

/**
 * Helper: Divide a single term by x
 * Returns the quotient if successful, undefined otherwise
 */
function divideTermByX(term: AstNode, x: string): AstNode | undefined {
  // Case 1: term is exactly x => quotient is 1
  if (term.kind === 'symbol' && (term.value as ASymbol).name === x) {
    return AstNode.create('number', 1);
  }

  // Case 2: term is mul(k, x) or mul(x, k) => quotient is k
  if (term.kind === 'func' && term.value === 'mul') {
    const factors = term.children || [];

    // Look for x in the factors
    const xIndex = factors.findIndex(f =>
      f.kind === 'symbol' && (f.value as ASymbol).name === x
    );

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

/**
 * all_divisible_by(terms, x) => boolean
 *
 * Returns true if all terms are divisible by x, false otherwise.
 */
export function all_divisible_by(args: AstNode[]): AstNode | undefined {
  if (args.length !== 2) return undefined;

  const termsNode = args[0];
  const xNode = args[1];

  let terms: ReadonlyArray<AstNode>;
  if (termsNode.kind === 'list') {
    terms = termsNode.children || [];
  } else {
    return undefined;
  }

  const x = xNode.kind === 'symbol' ? (xNode.value as ASymbol).name :
    xNode.kind === 'patvar' ? xNode.value as string :
      undefined;
  if (!x) return undefined;

  for (const term of terms) {
    const quotient = divideTermByX(term, x);
    if (quotient === undefined) {
      // Not divisible - return a "false" node
      return AstNode.create('number', 0);
    }
  }

  // All divisible - return a "true" node
  return AstNode.create('number', 1);
}

/**
 * Type checking constraint functions
 */

/**
 * is_symbol_name(x) - checks if x is a symbol (not a number or function)
 * Returns truthy if x is a symbol, falsy otherwise
 */
export function is_symbol_name(args: ReadonlyArray<AstNode>): AstNode | undefined {
  if (args.length !== 1) return undefined;

  const value = args[0];

  return value.kind === 'symbol'
    ? AstNode.create('number', 1)
    : AstNode.create('number', 0);
}

/**
 * is_number(x) - checks if x is a number
 * Returns truthy if x is a number, falsy otherwise
 */
export function is_number(args: ReadonlyArray<AstNode>): AstNode | undefined {
  if (args.length !== 1) return undefined;

  const value = args[0];

  return value.kind === 'number'
    ? AstNode.create('number', 1)
    : AstNode.create('number', 0);
}

/**
 * is_func(x) - checks if x is a function
 * Returns truthy if x is a function, falsy otherwise
 */
export function is_func(args: ReadonlyArray<AstNode>): AstNode | undefined {
  if (args.length !== 1) return undefined;

  const value = args[0];

  return value.kind === 'func'
    ? AstNode.create('number', 1)
    : AstNode.create('number', 0);
}

/**
 * is_func_name(x) - alias for is_func
 * Returns truthy if x is a function, falsy otherwise
 */
export function is_func_name(args: ReadonlyArray<AstNode>): AstNode | undefined {
  return is_func(args);
}

/**
 * Comparison constraint functions
 */

/**
 * gt(a, b) - greater than
 * Returns a truthy node if a > b, falsy otherwise
 */
export function gt(args: ReadonlyArray<AstNode>): AstNode | undefined {
  if (args.length !== 2) return undefined;

  const a = args[0];
  const b = args[1];

  if (a.kind !== 'number' || b.kind !== 'number') {
    return undefined;
  }

  return (a.value as number) > (b.value as number)
    ? AstNode.create('number', 1)
    : AstNode.create('number', 0);
}

/**
 * gte(a, b) - greater than or equal
 * Returns a truthy node if a >= b, falsy otherwise
 */
export function gte(args: ReadonlyArray<AstNode>): AstNode | undefined {
  if (args.length !== 2) return undefined;

  const a = args[0];
  const b = args[1];

  if (a.kind !== 'number' || b.kind !== 'number') {
    return undefined;
  }

  return (a.value as number) >= (b.value as number)
    ? AstNode.create('number', 1)
    : AstNode.create('number', 0);
}

/**
 * lt(a, b) - less than
 * Returns a truthy node if a < b, falsy otherwise
 */
export function lt(args: ReadonlyArray<AstNode>): AstNode | undefined {
  if (args.length !== 2) return undefined;

  const a = args[0];
  const b = args[1];

  if (a.kind !== 'number' || b.kind !== 'number') {
    return undefined;
  }

  return (a.value as number) < (b.value as number)
    ? AstNode.create('number', 1)
    : AstNode.create('number', 0);
}

/**
 * lte(a, b) - less than or equal
 * Returns a truthy node if a <= b, falsy otherwise
 */
export function lte(args: ReadonlyArray<AstNode>): AstNode | undefined {
  if (args.length !== 2) return undefined;

  const a = args[0];
  const b = args[1];

  if (a.kind !== 'number' || b.kind !== 'number') {
    return undefined;
  }

  return (a.value as number) <= (b.value as number)
    ? AstNode.create('number', 1)
    : AstNode.create('number', 0);
}

/**
 * Create and populate the default constraint function registry
 */
export function createDefaultConstraintRegistry(): ConstraintFunctionRegistry {
  const registry = new ConstraintFunctionRegistry();

  // Type checking functions
  registry.register('is_symbol_name', is_symbol_name);
  registry.register('is_number', is_number);
  registry.register('is_func', is_func);
  registry.register('is_func_name', is_func_name);

  // Comparison functions
  registry.register('gt', gt);
  registry.register('gte', gte);
  registry.register('lt', lt);
  registry.register('lte', lte);

  // List/array functions
  registry.register('map_div_by_x', map_div_by_x);
  registry.register('all_divisible_by', all_divisible_by);

  return registry;
}

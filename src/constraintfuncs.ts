import { AstNode, ASymbol } from "./ast.js";

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


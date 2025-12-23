// =============================================================================
// Simplification rules - Algebraic simplifications for solving
// =============================================================================

import { AstNode, ASymbol, isNumber, MatchFuncRet } from "../ast.js";
import { getArgs, isFunc } from "./corerules.js";

// Helper: Check if two nodes are the same symbol
function sameSymbol(a: AstNode, b: AstNode): boolean {
  if (a.kind !== 'symbol' || b.kind !== 'symbol') return false;
  const aSymbol = a.value as ASymbol;
  const bSymbol = b.value as ASymbol;
  return aSymbol.name === bSymbol.name;
}

// Helper: GCD of two numbers
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// Helper: GCD of an array of numbers
function gcdArray(nums: number[]): number {
  if (nums.length === 0) return 1;
  return nums.reduce((acc, n) => gcd(acc, n));
}

// Helper: Extract coefficient from a term
// Returns the numeric coefficient if the term is a number or mul(number, ...)
function getCoefficient(term: AstNode): number | undefined {
  if (isNumber(term)) {
    return term.value as number;
  }

  if (isFunc(term, 'mul')) {
    const mulArgs = getArgs(term);
    if (mulArgs.length >= 1 && isNumber(mulArgs[0])) {
      return mulArgs[0].value as number;
    }
  }

  if (isFunc(term, 'neg')) {
    const negArgs = getArgs(term);
    if (negArgs.length === 1) {
      const innerCoeff = getCoefficient(negArgs[0]);
      return innerCoeff !== undefined ? -innerCoeff : undefined;
    }
  }

  return undefined;
}

// Helper: Check if all terms are divisible by a number
function all_divisible_by(terms: ReadonlyArray<AstNode>, divisor: number): boolean {
  if (divisor === 0 || divisor === 1) return false;

  for (const term of terms) {
    const coeff = getCoefficient(term);
    if (coeff === undefined) return false;
    if (coeff % divisor !== 0) return false;
  }

  return true;
}

// Helper: Divide a term by a number
function divideTermBy(term: AstNode, divisor: number): AstNode {
  if (isNumber(term)) {
    const value = term.value as number;
    return AstNode.create('number', value / divisor);
  }

  if (isFunc(term, 'mul')) {
    const mulArgs = getArgs(term);
    if (mulArgs.length >= 1 && isNumber(mulArgs[0])) {
      const coeff = mulArgs[0].value as number;
      const newCoeff = AstNode.create('number', coeff / divisor);
      const rest = mulArgs.slice(1);

      if (rest.length === 0) {
        return newCoeff;
      } else if (rest.length === 1) {
        return AstNode.create('func', 'mul', [newCoeff, rest[0]]);
      } else {
        return AstNode.create('func', 'mul', [newCoeff, ...rest]);
      }
    }
  }

  if (isFunc(term, 'neg')) {
    const negArgs = getArgs(term);
    if (negArgs.length === 1) {
      const innerDivided = divideTermBy(negArgs[0], divisor);
      return AstNode.create('func', 'neg', [innerDivided]);
    }
  }

  // Fallback: create div node
  return AstNode.create('func', 'div', [term, AstNode.create('number', divisor)]);
}

// Helper: Map division over a list of terms
function map_div(terms: ReadonlyArray<AstNode>, divisor: number): AstNode[] {
  return terms.map(term => divideTermBy(term, divisor));
}

// =============================================================================
// Factor common divisor from sum
// =============================================================================

// sum(?terms...) => mul(?x, sum(?quot...))
//   where all_divisible_by([?terms...], ?x),
//         map_div([?terms...], ?x) => [?quot...]
export function ruleFactorCommonDivisor(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'sum')) return undefined;
  const terms = getArgs(ast);
  if (terms.length < 2) return undefined;

  // Extract coefficients from all terms
  const coefficients: number[] = [];
  for (const term of terms) {
    const coeff = getCoefficient(term);
    if (coeff === undefined) return undefined; // Can't factor if any term has no coefficient
    coefficients.push(coeff);
  }

  // Find GCD of all coefficients
  const commonDivisor = gcdArray(coefficients);

  // Only factor if GCD > 1
  if (commonDivisor <= 1) return undefined;

  // Verify all terms are divisible (should always be true if GCD calculation is correct)
  if (!all_divisible_by(terms, commonDivisor)) return undefined;

  // Divide all terms by the common divisor
  const quotients = map_div(terms, commonDivisor);

  // Build mul(?x, sum(?quot...))
  const quotientSum = quotients.length === 1
    ? quotients[0]
    : AstNode.create('func', 'sum', quotients);

  return {
    replace: AstNode.create('func', 'mul', [
      AstNode.create('number', commonDivisor),
      quotientSum
    ]),
    cost: 2 // Creates 2 new nodes: mul and possibly sum
  };
}

// =============================================================================
// Like terms - Combine coefficients of same variable
// =============================================================================

// eval(sum(?rest..., mul(?a, ?x), mul(?b, ?x), ?more...)) => eval(sum(?rest..., mul(sum(?a, ?b), ?x), ?more...))
// Combines adjacent like terms
export function ruleCombineLikeTerms(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sum')) return undefined;

  const sumArgs = getArgs(inner);
  if (sumArgs.length < 2) return undefined;

  // Look for pattern: mul(?a, ?x), mul(?b, ?x) anywhere in the sum
  for (let i = 0; i < sumArgs.length; i++) {
    for (let j = i + 1; j < sumArgs.length; j++) {
      const term1 = sumArgs[i];
      const term2 = sumArgs[j];

      // Check if both are mul with same variable
      if (isFunc(term1, 'mul') && isFunc(term2, 'mul')) {
        const mul1Args = getArgs(term1);
        const mul2Args = getArgs(term2);

        if (mul1Args.length === 2 && mul2Args.length === 2) {
          // Try matching mul(?a, ?x) and mul(?b, ?x)
          const [a1, x1] = mul1Args;
          const [a2, x2] = mul2Args;

          if (isNumber(a1) && isNumber(a2) && sameSymbol(x1, x2)) {
            // Found like terms: mul(a1, x) and mul(a2, x)
            const newCoeff = AstNode.create('func', 'sum', [a1, a2]);
            const combinedTerm = AstNode.create('func', 'mul', [newCoeff, x1]);

            // Build new sum with combined term
            const newTerms = [
              ...sumArgs.slice(0, i),
              ...sumArgs.slice(i + 1, j),
              combinedTerm,
              ...sumArgs.slice(j + 1)
            ];

            if (newTerms.length === 1) {
              return {
                replace: AstNode.create('func', 'eval', [newTerms[0]]),
                cost: 1 // Creates 1 new eval node
              };
            }

            return {
              replace: AstNode.create('func', 'eval', [
                AstNode.create('func', 'sum', newTerms)
              ]),
              cost: 4 // Creates 4 new nodes: eval, sum, mul, and sum for coefficient
            };
          }

          // Try reverse order: mul(?x, ?a)
          if (isNumber(x1) && isNumber(x2) && sameSymbol(a1, a2)) {
            const newCoeff = AstNode.create('func', 'sum', [x1, x2]);
            const combinedTerm = AstNode.create('func', 'mul', [a1, newCoeff]);

            const newTerms = [
              ...sumArgs.slice(0, i),
              ...sumArgs.slice(i + 1, j),
              combinedTerm,
              ...sumArgs.slice(j + 1)
            ];

            if (newTerms.length === 1) {
              return {
                replace: AstNode.create('func', 'eval', [newTerms[0]]),
                cost: 1 // Creates 1 new eval node
              };
            }

            return {
              replace: AstNode.create('func', 'eval', [
                AstNode.create('func', 'sum', newTerms)
              ]),
              cost: 4 // Creates 4 new nodes: eval, sum, mul, and sum for coefficient
            };
          }
        }
      }
    }
  }

  return undefined;
}

// =============================================================================
// Subtraction expansion rules
// =============================================================================

// eval(sub(sum(?terms...), ?b)) => eval(sum(?terms..., neg(?b)))
// Expands subtraction of sum to add negation
export function ruleSubExpandSum(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sub')) return undefined;

  const subArgs = getArgs(inner);
  if (subArgs.length !== 2) return undefined;

  const [a, b] = subArgs;

  // If a is sum, expand: sub(sum(...), b) => sum(..., neg(b))
  if (isFunc(a, 'sum')) {
    const sumArgs = getArgs(a);
    const newTerms = [...sumArgs, AstNode.create('func', 'neg', [b])];
    return {
      replace: AstNode.create('func', 'eval', [
        AstNode.create('func', 'sum', newTerms)
      ]),
      cost: 3 // Creates 3 new nodes: eval, sum, and neg
    };
  }

  return undefined;
}

// eval(sum(?rest..., ?a, ?b, ?more...)) => eval(sum(?rest..., sum(?a, ?b), ?more...))
// where ?a and ?b are numbers
// Combines any two numbers in a sum
export function ruleCombineNumbers(ast: AstNode): MatchFuncRet | undefined {
  if (!isFunc(ast, 'eval')) return undefined;
  const args = getArgs(ast);
  if (args.length !== 1) return undefined;

  const inner = args[0];
  if (!isFunc(inner, 'sum')) return undefined;

  const sumArgs = getArgs(inner);
  if (sumArgs.length < 2) return undefined;

  // Find any pair of numbers (not just adjacent)
  for (let i = 0; i < sumArgs.length; i++) {
    for (let j = i + 1; j < sumArgs.length; j++) {
      if (isNumber(sumArgs[i]) && isNumber(sumArgs[j])) {
        // Found two numbers, combine them
        const newTerms = [
          ...sumArgs.slice(0, i),
          ...sumArgs.slice(i + 1, j),
          AstNode.create('func', 'sum', [sumArgs[i], sumArgs[j]]),
          ...sumArgs.slice(j + 1)
        ];

        if (newTerms.length === 1) {
          return {
            replace: AstNode.create('func', 'eval', [newTerms[0]]),
            cost: 1 // Creates 1 new eval node
          };
        }

        return {
          replace: AstNode.create('func', 'eval', [
            AstNode.create('func', 'sum', newTerms)
          ]),
          cost: 3 // Creates 3 new nodes: eval, outer sum, and inner sum for numbers
        };
      }
    }
  }

  return undefined;
}
